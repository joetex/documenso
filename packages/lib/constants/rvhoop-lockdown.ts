/**
 * RVHOOP FORK ADDITION.
 *
 * Documenso, in this deployment, is a template editor and nothing else.
 *
 * Park staff reach it from the RVHoop Landlord Portal to build and maintain the
 * lease templates their park sends. Everything that surrounds a template in
 * stock Documenso — raising a document, choosing recipients, sending it,
 * chasing it, managing who has access, billing, API tokens, webhooks — is
 * RVHoop's job, done from RVHoop's own UI against Documenso's API. Leaving
 * those surfaces reachable would mean a manager can send a lease that RVHoop
 * never recorded, or grant access RVHoop's RBAC never approved.
 *
 * So the browser session is confined to one screen. Two guards enforce it and
 * both read from this file, so they cannot drift apart:
 *
 *   - `isRvhoopAllowedPath` — apps/remix/server/redirects.ts, for page loads.
 *   - `isRvhoopAllowedProcedure` — packages/trpc/server/trpc.ts, for data.
 *
 * Both are **allowlists**. A procedure or route that arrives in a future
 * upstream merge is denied until someone has read it and decided otherwise,
 * which is the only way this survives merges that add new ways to send a
 * document.
 *
 * ## What is deliberately NOT locked down
 *
 * **API tokens.** The tRPC guard only runs for session-authenticated requests.
 * RVHoop's backend authenticates with an API token and keeps the full surface —
 * that is precisely how it creates documents from these templates and sends
 * them.
 *
 * **The signing ceremony.** The guard hangs off `authenticatedMiddleware`.
 * Signing runs on `procedure` / `maybeAuthenticatedProcedure` and keys off a
 * recipient token, so a guest signing a lease is untouched.
 *
 * **`/admin`.** Documenso already gates it on `isAdmin`, and no RVHoop-
 * provisioned user is ever granted that role. Blocking it here would lock the
 * operator out of their own instance.
 */

/**
 * tRPC procedure paths a template author needs, traced from the templates list,
 * the shared envelope editor, and `envelope-editor-provider.tsx`.
 *
 * An entry ending in `.` is a namespace prefix; anything else is an exact path.
 */
const ALLOWED_TRPC_PROCEDURES = [
  // The editor itself: load, autosave title/settings, place fields, define the
  // template's recipient placeholders.
  'envelope.editor.get',
  'envelope.get',
  'envelope.create', // additionally required to carry type: TEMPLATE, see below
  'envelope.update',
  'envelope.delete',
  'envelope.duplicate',
  'envelope.recipient.set',
  'envelope.field.get',
  'envelope.field.set',
  'envelope.field.createMany',
  'envelope.field.updateMany',
  'envelope.field.delete',

  // The PDFs a template is built on, and its attachments.
  'envelope.item.',
  'envelope.attachment.',

  // Organising the list. `bulk.cancel` is absent on purpose — cancelling is an
  // operation on a document in flight, and there are none here.
  'envelope.bulk.move',
  'envelope.bulk.delete',
  'folder.',

  // The templates list, the organisation-wide template picker, and the command
  // menu's template search.
  'template.findTemplates',
  'template.findOrganisationTemplates',
  'template.getTemplateById',
  'template.getOrganisationTemplateById',
  'template.updateTemplate',
  'template.search',

  // Reads the shell and the editor's settings dialog make to render.
  //
  // `organisation.internal.getOrganisationSession` is the load-bearing one: it
  // is what fills `useSession().organisations`, and without it the client can't
  // resolve the team in the URL and every page renders "Team not found". It is
  // the only member of its namespace, so it is listed by name rather than as a
  // prefix — an `organisation.internal.` prefix would silently admit whatever
  // upstream adds beside it.
  'organisation.internal.getOrganisationSession',
  'organisation.get',
  'organisation.getMany',
  'organisation.getQuotaFlags',
  'team.find',
  'recipient.suggestions.find',
  'enterprise.organisation.email.find',
] as const;

/**
 * Whether a session-authenticated tRPC call is part of building a template.
 *
 * Notable denials, all of which are RVHoop's job: `envelope.distribute` and
 * `envelope.redistribute` (sending), `envelope.cancel` / `envelope.bulk.cancel`,
 * `template.createDocumentFromTemplate` and `template.uploadBulkSend` (raising
 * documents), every direct-link procedure (a public signing URL is a send by
 * another name), all of `apiToken.*` and `webhook.*`, every `document.*` route,
 * and every `organisation.*` / `team.*` mutation.
 */
export const isRvhoopAllowedProcedure = (path: string): boolean =>
  ALLOWED_TRPC_PROCEDURES.some((allowed) => (allowed.endsWith('.') ? path.startsWith(allowed) : path === allowed));

/**
 * Page paths a browser session may load.
 *
 * Only `/t/` is treated as default-deny, because that is where the authoring
 * app lives and where upstream adds screens. Top-level namespaces are named
 * explicitly: `/o/` (organisation settings), `/settings` (account, billing,
 * tokens), `/inbox` and `/dashboard`. Everything else — sign-in, the API, the
 * signing routes, embeds, static assets — passes through untouched.
 */
export const isRvhoopAllowedPath = (pathname: string): boolean => {
  const path = normalisePath(pathname);

  if (path.startsWith('/t/')) {
    // /t/<teamUrl>/templates and everything under it.
    const [, , , section] = path.split('/');

    return section === 'templates';
  }

  return !(
    path === '/o' ||
    path.startsWith('/o/') ||
    path === '/settings' ||
    path.startsWith('/settings/') ||
    path === '/inbox' ||
    path === '/dashboard'
  );
};

/**
 * Where to send a browser that asked for something it may not have.
 *
 * A blocked path under `/t/` names its own team, so it can bounce straight into
 * that park's templates. Anything else falls back to the `preferred-team-url`
 * cookie that `appMiddleware` maintains, and to `/` when even that is missing —
 * the root loader picks a team and lands on its templates.
 */
export const rvhoopFallbackPath = (pathname: string, preferredTeamUrl?: string): string => {
  const path = normalisePath(pathname);

  const teamUrl = path.startsWith('/t/') ? path.split('/')[2] : preferredTeamUrl;

  return teamUrl ? `/t/${teamUrl}/templates` : '/';
};

/**
 * React Router serves client-side navigations from `<path>.data`, so both
 * spellings of the same route have to normalise to one thing before matching.
 */
const normalisePath = (pathname: string): string => {
  const path = pathname.replace(/\.data$/, '');

  return path.length > 1 ? path.replace(/\/+$/, '') : path;
};
