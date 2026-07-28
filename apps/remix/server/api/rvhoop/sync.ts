import { createHash, timingSafeEqual } from 'node:crypto';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';
import { createTeamMembers } from '@documenso/trpc/server/team-router/create-team-members';
import {
  type OrganisationGroupType,
  OrganisationMemberRole,
  OrganisationType,
  TeamMemberRole,
  WebhookTriggerEvents,
} from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

/**
 * Provisioning bridge for the RVHoop park-management app.
 *
 * RVHOOP FORK ADDITION, and additive: this file and its one line in
 * server/router.ts are its whole surface. It exists because organisation and
 * team management is tRPC-only upstream (the OpenAPI meta on `team.create` is
 * commented out), so RVHoop cannot provision a park's workspace with an API
 * token. Everything here calls Documenso's own server-side functions rather
 * than reaching into tables directly, so upstream changes to how membership
 * works are inherited, not re-implemented.
 *
 * The model it maintains:
 *
 *   a park          → its own organisation
 *   that park       → exactly one team inside it
 *   a park's staff  → organisation MEMBER + membership of that one team
 *
 * A park is its own organisation because parks are independent businesses, not
 * departments of RVHoop: one park's workspace should share no owner, no claim,
 * no settings tree and no member list with another's.
 *
 * The team is not a second tenancy layer, it is a required implementation
 * detail. `Envelope.teamId` is non-null, so every template belongs to a team,
 * and every authoring route in the app is `/t/<teamUrl>/…`. `createOrganisation`
 * deliberately does not create one (only `createPersonalOrganisation` does), so
 * there is no org-only shape to use instead. One per park, and nothing in the
 * locked-down UI ever offers to make a second.
 *
 * Every operation is idempotent. RVHoop calls this on each launch of the
 * template workspace, so the common case is "everything already exists".
 */
export const rvhoopSyncRoute = new Hono();

const ZSyncRequestSchema = z.object({
  park: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
  }),
  /**
   * Ask for the machine credentials RVHoop needs to RAISE documents, as opposed
   * to the workspace a human needs to author templates.
   *
   * Both are provisioned here for the same reason the team is: the operations
   * are tRPC-only or role-gated in ways an API token cannot satisfy on its own
   * (`createApiToken` requires MANAGE_TEAM, and the webhook router has no
   * OpenAPI meta at all, so it is not on the v2 REST surface).
   *
   * Off by default so the ordinary launch path — which happens on every click
   * of "Manage document templates" — stays a pure read.
   */
  credentials: z
    .object({
      /** Mint an API token if the park has none. The value is returned ONCE. */
      apiToken: z.boolean().optional(),
      /** Register (or re-point) the completion webhook at this URL. */
      webhookUrl: z.string().url().optional(),
      /** Shared secret Documenso sends back in `X-Documenso-Secret`. */
      webhookSecret: z.string().min(16).optional(),
    })
    .optional(),
});

/**
 * The owner of every park organisation. A real user row because Documenso hangs
 * ownership off one, but not a person: it has no password and no OAuth account,
 * so nothing can sign in as it. It is also the actor every provisioning call
 * below runs as, which is why those calls pass its permission checks.
 */
const SYSTEM_USER_EMAIL = 'system@rvhoop.com';
const SYSTEM_USER_NAME = 'RVHoop System';

/**
 * Names the one API token per team that RVHoop owns, so provisioning can find
 * and rotate its own credential without disturbing any other. Nothing else in
 * this deployment should be creating tokens — the lockdown denies `apiToken.*`
 * to browser sessions — but the name makes that assumption checkable.
 */
const RVHOOP_API_TOKEN_NAME = 'RVHoop';

const bearerMatches = (given: string, expected: string) => {
  const a = Buffer.from(given, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');

  if (a.length !== b.length) {
    timingSafeEqual(a, a);

    return false;
  }

  return timingSafeEqual(a, b);
};

/**
 * One identifier per park, used as both the organisation url and the team url —
 * `Organisation.url` and `Team.url` are unique within their own tables and
 * `/o/` never collides with `/t/`, so the same string can serve both and a park
 * has exactly one slug to recognise.
 *
 * It is readable, globally unique, and stable across park renames: the suffix is
 * derived from the park's immutable id and lookups match on the suffix alone, so
 * renaming a park updates the display names and leaves the urls — and every
 * template link under them — exactly where they were.
 */
const parkSlugParts = (park: { id: string; name: string }) => {
  const suffix = createHash('sha256').update(park.id).digest('hex').slice(0, 8);

  const slug =
    park.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)
      .replace(/-+$/g, '') || 'park';

  return { suffix, url: `${slug}-${suffix}` };
};

const ensureSystemUser = async () => {
  const existing = await prisma.user.findFirst({
    where: { email: SYSTEM_USER_EMAIL },
  });

  if (existing) {
    return existing;
  }

  // Deliberately not via createUser/onCreateUserHook: that would give the
  // service account a personal organisation and a personal team it will never
  // use, cluttering the admin views.
  return await prisma.user.create({
    data: {
      email: SYSTEM_USER_EMAIL,
      name: SYSTEM_USER_NAME,
      emailVerified: new Date(),
    },
  });
};

const ensureParkOrganisation = async (options: { systemUserId: number; park: { id: string; name: string } }) => {
  const { systemUserId, park } = options;
  const { suffix, url } = parkSlugParts(park);

  const existing = await prisma.organisation.findFirst({
    where: { url: { endsWith: `-${suffix}` } },
    include: { groups: true },
  });

  if (existing) {
    // Keep the display name in step with the park; the url intentionally stays.
    if (existing.name !== park.name) {
      return await prisma.organisation.update({
        where: { id: existing.id },
        data: { name: park.name },
        include: { groups: true },
      });
    }

    return existing;
  }

  const freeClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

  await createOrganisation({
    name: park.name,
    url,
    type: OrganisationType.ORGANISATION,
    userId: systemUserId,
    // 0 means unlimited. The free claim ships 1 team / 1 member, and while those
    // caps only bind when billing is enabled, this instance is self-hosted and a
    // park's whole staff works in one organisation — leaving the member cap in
    // place would turn on a limit nobody is being billed for the moment Stripe
    // keys appear.
    claim: { ...freeClaim, teamCount: 0, memberCount: 0 },
  });

  const created = await prisma.organisation.findFirst({
    where: { url },
    include: { groups: true },
  });

  if (!created) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Organisation creation did not produce an organisation',
    });
  }

  return created;
};

const ensureTeam = async (options: {
  organisationId: string;
  systemUserId: number;
  park: { id: string; name: string };
}) => {
  const { organisationId, systemUserId, park } = options;
  const { suffix, url } = parkSlugParts(park);

  const existing = await prisma.team.findFirst({
    where: {
      url: { endsWith: `-${suffix}` },
    },
  });

  if (existing) {
    // `Team.url` is unique across every organisation, so a team carrying this
    // park's suffix under a different organisation is not something to silently
    // work around — it means an earlier tenancy shape was left in place and the
    // teardown was skipped. Say so, rather than failing on a raw P2002 two
    // statements later.
    if (existing.organisationId !== organisationId) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: `Team "${existing.url}" already exists under a different organisation. Remove the legacy "rvhoop" organisation before provisioning parks as organisations.`,
      });
    }

    // Keep the display name in step with the park; the url intentionally stays.
    if (existing.name !== park.name) {
      return await prisma.team.update({
        where: { id: existing.id },
        data: { name: park.name },
      });
    }

    return existing;
  }

  await createTeam({
    userId: systemUserId,
    teamName: park.name,
    teamUrl: url,
    organisationId,
    // Organisation MEMBERs are not inherited into the team, so team access is
    // granted explicitly by ensureTeamMember below. Isolation between parks
    // comes from the organisation now, not from this flag.
    inheritMembers: false,
  });

  const created = await prisma.team.findFirst({
    where: { url },
  });

  if (!created) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Team creation did not produce a team',
    });
  }

  return created;
};

const ensureUser = async (user: { email: string; name: string }) => {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' } },
  });

  if (existing) {
    return existing;
  }

  // Email-verified on creation because RVHoop only ever sends an address it
  // proved with a one-time code at sign-in, and no personal organisation
  // because this account exists to work inside its parks' organisations.
  return await prisma.user.create({
    data: {
      email: user.email.toLowerCase(),
      name: user.name,
      emailVerified: new Date(),
    },
  });
};

const ensureOrganisationMember = async (options: {
  userId: number;
  organisationId: string;
  groups: { id: string; type: OrganisationGroupType; organisationRole: OrganisationMemberRole }[];
}) => {
  const { userId, organisationId, groups } = options;

  const existing = await prisma.organisationMember.findFirst({
    where: { userId, organisationId },
  });

  if (existing) {
    return existing;
  }

  await addUserToOrganisation({
    userId,
    organisationId,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    organisationGroups: groups as Parameters<typeof addUserToOrganisation>[0]['organisationGroups'],
    // MEMBER for everyone. Organisation ADMIN/MANAGER unlocks organisation
    // settings, member management and team creation — all of which are RVHoop's
    // job and are blocked by the lockdown anyway. Nothing a template author does
    // needs more than this.
    organisationMemberRole: OrganisationMemberRole.MEMBER,
    // RVHoop is the one telling us to do this, in response to the user's own
    // click. A "you were added to an organisation" email would be noise.
    bypassEmail: true,
  });

  const member = await prisma.organisationMember.findFirst({
    where: { userId, organisationId },
  });

  if (!member) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Organisation member creation did not produce a member',
    });
  }

  return member;
};

const ensureTeamMember = async (options: { teamId: number; organisationMemberId: string; systemUserId: number }) => {
  const { teamId, organisationMemberId, systemUserId } = options;

  // Team access is expressed as membership of an organisation group that is
  // attached to the team, so that — and not a TeamMember row — is what "is
  // already a member" means here.
  const existing = await prisma.organisationGroupMember.findFirst({
    where: {
      organisationMemberId,
      group: {
        teamGroups: {
          some: { teamId },
        },
      },
    },
  });

  if (existing) {
    return;
  }

  await createTeamMembers({
    userId: systemUserId,
    teamId,
    membersToCreate: [
      {
        organisationMemberId,
        // One role for everyone who gets this far. RVHoop's own RBAC already
        // decided who may reach the workspace at all (park:write), the lockdown
        // removes every ADMIN-only surface except template CRUD, and a uniform
        // role means TEAM_DOCUMENT_VISIBILITY_MAP can never hide one manager's
        // template from another at the same park.
        teamRole: TeamMemberRole.ADMIN,
      },
    ],
  });
};

/**
 * The API token RVHoop authenticates with when it raises a document from one of
 * this park's templates.
 *
 * Owned by the system user, scoped to the park's team — Documenso's tokens are
 * `{userId, teamId}` pairs, so there is no such thing as one credential for the
 * whole platform, and a token that leaked would reach exactly one park.
 *
 * The plaintext exists only in the return value of `createApiToken`; the row
 * stores a hash. So this returns it exactly once, on the call that creates it,
 * and RVHoop stores it encrypted. A caller that has lost the token gets `null`
 * and must revoke first — hence `rotate`.
 */
const ensureApiToken = async (options: { systemUserId: number; teamId: number; rotate: boolean }) => {
  const { systemUserId, teamId, rotate } = options;

  const existing = await prisma.apiToken.findFirst({
    where: { teamId, userId: systemUserId, name: RVHOOP_API_TOKEN_NAME },
  });

  if (existing && !rotate) {
    // Nothing to hand back — the plaintext is unrecoverable by design.
    return { id: existing.id, token: null };
  }

  if (existing) {
    await prisma.apiToken.delete({ where: { id: existing.id } });
  }

  const created = await createApiToken({
    userId: systemUserId,
    teamId,
    tokenName: RVHOOP_API_TOKEN_NAME,
    // Never expires. An expiring credential on the booking path fails at the
    // worst possible moment — a guest mid-checkout — and RVHoop has no way to
    // notice beforehand. Revocation is the control here, not expiry.
    expiresIn: null,
  });

  return { id: created.id, token: created.token };
};

/**
 * The completion webhook. Without it a guest who signs and closes the tab leaves
 * their reservation stuck at PENDING_SIGNATURE until they happen to return.
 *
 * Idempotent by URL: re-pointing an existing RVHoop webhook rather than piling
 * up duplicates, which would make Documenso deliver the same completion several
 * times. RVHoop's handler is itself idempotent, but duplicate delivery is still
 * noise worth not creating.
 *
 * Note this calls `createWebhook` directly rather than the tRPC procedure, so it
 * skips `assertWebhookUrl`'s SSRF check. That is correct here and only here: the
 * URL is RVHoop's own, built server-side from configuration, never user input.
 */
const ensureWebhook = async (options: {
  systemUserId: number;
  teamId: number;
  webhookUrl: string;
  secret: string;
}) => {
  const { systemUserId, teamId, webhookUrl, secret } = options;

  const eventTriggers: WebhookTriggerEvents[] = [
    WebhookTriggerEvents.DOCUMENT_COMPLETED,
    WebhookTriggerEvents.DOCUMENT_REJECTED,
    WebhookTriggerEvents.DOCUMENT_CANCELLED,
  ];

  const existing = await prisma.webhook.findFirst({
    where: { teamId, webhookUrl },
  });

  if (existing) {
    const updated = await prisma.webhook.update({
      where: { id: existing.id },
      data: { eventTriggers, secret, enabled: true },
    });

    return { id: updated.id };
  }

  const created = await createWebhook({
    webhookUrl,
    eventTriggers,
    secret,
    enabled: true,
    userId: systemUserId,
    teamId,
  });

  return { id: created.id };
};

rvhoopSyncRoute.post('/sync', async (c) => {
  const secret = env('NEXT_PRIVATE_RVHOOP_BRIDGE_SECRET');

  if (!secret) {
    return c.json({ error: 'RVHoop bridge is not configured' }, 503);
  }

  const authorization = c.req.header('authorization') ?? '';

  if (!authorization.startsWith('Bearer ') || !bearerMatches(authorization.slice(7), secret)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = ZSyncRequestSchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    return c.json({ error: 'Invalid request body', issues: body.error.issues }, 400);
  }

  const { park, user } = body.data;

  const systemUser = await ensureSystemUser();
  const organisation = await ensureParkOrganisation({ systemUserId: systemUser.id, park });
  const team = await ensureTeam({
    organisationId: organisation.id,
    systemUserId: systemUser.id,
    park,
  });

  const documensoUser = await ensureUser(user);

  // The organisation owner is already an implicit admin everywhere; running the
  // member/team steps for it would try to add it to a group it created.
  if (documensoUser.id !== systemUser.id) {
    const member = await ensureOrganisationMember({
      userId: documensoUser.id,
      organisationId: organisation.id,
      groups: organisation.groups,
    });

    await ensureTeamMember({
      teamId: team.id,
      organisationMemberId: member.id,
      systemUserId: systemUser.id,
    });
  }

  const credentials = body.data.credentials;

  let apiToken: { id: number; token: string | null } | undefined;
  let webhook: { id: string } | undefined;

  if (credentials?.apiToken) {
    apiToken = await ensureApiToken({
      systemUserId: systemUser.id,
      teamId: team.id,
      // RVHoop asks for a token only when it has none stored, so reaching here
      // with one already on file means its copy is unrecoverable — rotate.
      rotate: true,
    });
  }

  if (credentials?.webhookUrl && credentials.webhookSecret) {
    webhook = await ensureWebhook({
      systemUserId: systemUser.id,
      teamId: team.id,
      webhookUrl: credentials.webhookUrl,
      secret: credentials.webhookSecret,
    });
  }

  return c.json({
    organisationUrl: organisation.url,
    teamUrl: team.url,
    teamId: team.id,
    ...(apiToken ? { apiToken } : {}),
    ...(webhook ? { webhook } : {}),
  });
});
