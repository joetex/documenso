import { authClient } from '@documenso/auth/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Trans } from '@lingui/react/macro';
import { OrganisationType } from '@prisma/client';
import { Building2Icon, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useOptionalCurrentTeam } from '~/providers/team';

export const OrgMenuSwitcher = () => {
  const { user, organisations } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);

  const isUserAdmin = isAdmin(user);

  // RVHOOP FORK ADDITION. Every organisation here is a park, with one exception:
  // an account that predates `skipPersonalOrganisation` still carries the
  // "Personal Organisation" upstream used to hand out on signup. That is not a
  // park and listing it as one would be a lie.
  const parks = useMemo(() => organisations.filter((org) => org.type === OrganisationType.ORGANISATION), [
    organisations,
  ]);

  const currentOrganisation = useOptionalCurrentOrganisation();
  const currentTeam = useOptionalCurrentTeam();

  const formatAvatarFallback = (name?: string) => {
    if (name !== undefined) {
      return name.slice(0, 1).toUpperCase();
    }

    return user.name ? extractInitials(user.name) : user.email.slice(0, 1).toUpperCase();
  };

  // RVHOOP FORK ADDITION. Upstream puts the Documenso role in the secondary
  // line. Every park user holds the same role here by design, so it would read
  // as "Admin" for everyone and imply an authority Documenso is not where you
  // exercise. The signed-in person is the useful second line.
  const dropdownMenuAvatarText = useMemo(() => {
    const park = currentTeam ?? currentOrganisation;

    if (park) {
      return {
        avatarSrc: formatAvatarUrl(park.avatarImageId),
        avatarFallback: formatAvatarFallback(park.name),
        primaryText: park.name,
        secondaryText: user.name ?? user.email,
      };
    }

    return {
      avatarSrc: formatAvatarUrl(user.avatarImageId),
      avatarFallback: formatAvatarFallback(user.name ?? user.email),
      primaryText: user.name,
      secondaryText: user.email,
    };
  }, [currentTeam, currentOrganisation, user]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="menu-switcher"
          variant="none"
          className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
        >
          <AvatarWithText
            avatarSrc={dropdownMenuAvatarText.avatarSrc}
            avatarFallback={dropdownMenuAvatarText.avatarFallback}
            primaryText={dropdownMenuAvatarText.primaryText}
            secondaryText={dropdownMenuAvatarText.secondaryText}
            rightSideComponent={<ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />}
            textSectionClassName="hidden lg:flex"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn('z-[60] ml-6 flex w-full flex-col p-0 md:ml-0 md:min-w-[16rem]')}
        align="end"
        forceMount
      >
        {/*
          RVHOOP FORK ADDITION. Upstream is a three-column Organisations / Teams
          / Settings browser. Under the park-per-organisation model an
          organisation *is* a park and holds exactly one team, so the Teams
          column would repeat the Organisations column verbatim; and every
          settings destination — organisation settings, team settings, account,
          billing, the personal inbox — is either a send surface or an access
          surface, both of which are RVHoop's. What is left is a park picker.
        */}
        <div className="flex w-full flex-col">
          <div className="flex h-12 items-center border-b p-2">
            <h3 className="flex items-center px-2 font-medium text-muted-foreground text-sm">
              <Building2Icon className="mr-2 h-3.5 w-3.5" />
              <Trans>Parks</Trans>
            </h3>
          </div>

          <div className="max-h-[20rem] flex-1 space-y-1 overflow-y-auto p-1.5">
            {parks.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className={cn(
                  'w-full px-4 py-2 text-muted-foreground',
                  org.id === currentOrganisation?.id && 'bg-accent',
                )}
                asChild
              >
                {/*
                  Straight to the park's templates. `/o/<url>` is an
                  organisation overview, which is blocked — and with one team
                  per park there is nothing there to overview anyway.
                */}
                <Link to={org.teams.at(0) ? `/t/${org.teams[0].url}/templates` : '/'} className="flex items-center">
                  <span
                    className={cn('min-w-0 flex-1 truncate', {
                      'font-semibold': org.id === currentOrganisation?.id,
                    })}
                  >
                    {org.name}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>

          <div className="border-t p-1.5">
            {isUserAdmin && (
              <DropdownMenuItem className="px-4 py-2 text-muted-foreground" asChild>
                <Link to="/admin">
                  <Trans>Admin panel</Trans>
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem className="px-4 py-2 text-muted-foreground" onClick={() => setLanguageSwitcherOpen(true)}>
              <Trans>Language</Trans>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:!text-muted-foreground px-4 py-2 text-muted-foreground"
              onSelect={async () => authClient.signOut()}
            >
              <Trans>Sign Out</Trans>
            </DropdownMenuItem>
          </div>
        </div>
      </DropdownMenuContent>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />
    </DropdownMenu>
  );
};
