import { extractCookieFromHeaders } from '@documenso/auth/server/lib/utils/cookies';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import { msg } from '@lingui/core/macro';
import { redirect } from 'react-router';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  if (session.isAuthenticated) {
    const teamUrlCookie = extractCookieFromHeaders('preferred-team-url', request.headers);

    // const referrer = request.headers.get('referer');
    // let isReferrerFromTeamUrl = false;

    // if (referrer) {
    //   const referrerUrl = new URL(referrer);

    //   if (referrerUrl.pathname.startsWith('/t/')) {
    //     isReferrerFromTeamUrl = true;
    //   }
    // }

    const preferredTeamUrl =
      teamUrlCookie && ZTeamUrlSchema.safeParse(teamUrlCookie).success ? teamUrlCookie : undefined;

    // // Early return for no preferred team.
    // if (!preferredTeamUrl || isReferrerFromTeamUrl) {
    //   throw redirect('/inbox');
    // }

    const teams = await getTeams({ userId: session.user.id });

    // RVHOOP FORK ADDITION. Upstream falls back to `/inbox` whenever a preferred
    // team can't be resolved, including when the user simply belongs to more
    // than one. Under the lockdown `/inbox` bounces straight back here, so that
    // would loop — and a manager of two parks is now two teams, so it is the
    // ordinary case, not an edge one. Land on any team instead; the switcher is
    // right there.
    const currentTeam = teams.find((team) => team.url === preferredTeamUrl) ?? teams.at(0);

    if (currentTeam) {
      throw redirect(formatTemplatesPath(currentTeam.url));
    }

    // Falls through to the component below: no team means no workspace to land
    // in, and every other landing page is blocked.
    return null;
  }

  throw redirect('/signin');
}

/**
 * RVHOOP FORK ADDITION. Only reachable for a signed-in user with no team, which
 * means RVHoop has not provisioned them. A terminal page, deliberately — the
 * alternative is a redirect to a route that redirects back.
 */
export default function IndexPage() {
  return (
    <GenericErrorLayout
      errorCode={404}
      errorCodeMap={{
        404: {
          subHeading: msg`No workspace`,
          heading: msg`Nothing here yet`,
          message: msg`Open document templates from the RVHoop Landlord Portal and your park's workspace will be set up for you.`,
        },
      }}
      primaryButton={null}
      secondaryButton={null}
    />
  );
}
