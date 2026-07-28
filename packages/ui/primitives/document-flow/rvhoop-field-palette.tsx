import {
  RVHOOP_FIELD_GROUPS,
  RVHOOP_FIELDS,
  type RvhoopFieldDef,
  type RvhoopFieldGroup,
} from '@documenso/lib/constants/rvhoop-fields';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronRight, Database, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '../../lib/utils';
import { Input } from '../input';

/**
 * RVHOOP FORK ADDITION — the "Pre-populated RVHoop Fields" palette.
 *
 * Park staff reach this editor from the RVHoop portal to build the documents
 * their guests sign. Every one of these entries is a datum RVHoop already holds
 * about a booking, so a manager should never be retyping a rent figure or a
 * move-out notice period into a template — they drop the field where the value
 * belongs and RVHoop fills it when the document is raised for a real stay.
 *
 * The catalog is generated from RVHoop's backend (see the header of
 * ../../../lib/constants/rvhoop-fields.ts), which is also what fills the tokens.
 * One list, so the palette can't offer a field the filler doesn't know.
 *
 * A hundred-odd fields is too many for the card grid the built-in types use, so
 * this is a searchable, grouped list: collapsed by default, and searching opens
 * whichever groups match. The manager who knows they want "start date" types it;
 * the one browsing for what's available opens "Stay".
 */
export type RvhoopFieldPaletteProps = {
  /** Token of the field currently armed for placement, if it came from here. */
  selectedToken: string | null;
  onSelect: (_field: RvhoopFieldDef) => void;
  disabled?: boolean;
};

const FIELDS_BY_GROUP = RVHOOP_FIELD_GROUPS.map((group) => ({
  group,
  fields: RVHOOP_FIELDS.filter((field) => field.group === group),
})).filter((entry) => entry.fields.length > 0);

const matches = (field: RvhoopFieldDef, needle: string) =>
  field.label.toLowerCase().includes(needle) ||
  field.token.toLowerCase().includes(needle) ||
  field.group.toLowerCase().includes(needle) ||
  field.description.toLowerCase().includes(needle);

export const RvhoopFieldPalette = ({ selectedToken, onSelect, disabled = false }: RvhoopFieldPaletteProps) => {
  const { t } = useLingui();

  const [query, setQuery] = useState('');
  const [manuallyOpened, setManuallyOpened] = useState<RvhoopFieldGroup[]>([]);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!needle) {
      return FIELDS_BY_GROUP;
    }

    return FIELDS_BY_GROUP.map((entry) => ({
      group: entry.group,
      fields: entry.fields.filter((field) => matches(field, needle)),
    })).filter((entry) => entry.fields.length > 0);
  }, [needle]);

  // While searching, every group holding a hit is open — a match hidden behind a
  // collapsed header reads as "no results".
  const openGroups = needle ? visible.map((entry) => entry.group) : manuallyOpened;

  const toggleGroup = (group: RvhoopFieldGroup) =>
    setManuallyOpened((open) => (open.includes(group) ? open.filter((g) => g !== group) : [...open, group]));

  const totalMatches = visible.reduce((count, entry) => count + entry.fields.length, 0);

  return (
    <section className="mt-6" aria-labelledby="rvhoop-fields-heading">
      <header className="flex items-start gap-x-2">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 id="rvhoop-fields-heading" className="font-medium text-foreground text-sm">
            <Trans>Pre-populated RVHoop Fields</Trans>
          </h3>
          <p className="mt-0.5 text-muted-foreground text-xs">
            <Trans>
              Read-only values RVHoop fills in from the booking when this document is sent. Drop one where the value
              should print — the signer can see it but cannot change it.
            </Trans>
          </p>
        </div>
      </header>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t`Search RVHoop fields`}
          aria-label={t`Search RVHoop fields`}
          className="h-8 bg-background pl-8 text-sm"
        />
      </div>

      {needle && totalMatches === 0 && (
        <p className="mt-3 text-muted-foreground text-xs">
          <Trans>No RVHoop field matches “{query}”.</Trans>
        </p>
      )}

      <div className="mt-2 divide-y divide-border border-border border-t">
        {visible.map(({ group, fields }) => {
          const isOpen = openGroups.includes(group);

          return (
            <div key={group}>
              <button
                type="button"
                disabled={disabled}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center gap-x-1.5 py-2 text-left text-foreground text-xs disabled:opacity-50"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                <span className="font-medium">{group}</span>
                <span className="text-muted-foreground">({fields.length})</span>
              </button>

              {isOpen && (
                <ul className="pb-2">
                  {fields.map((field) => {
                    const isSelected = selectedToken === field.token;

                    return (
                      <li key={field.token}>
                        <button
                          type="button"
                          disabled={disabled}
                          // Both handlers, matching the built-in field cards:
                          // mousedown arms the drag so the ghost tracks the
                          // cursor straight away, and the click that follows
                          // re-asserts it for keyboard and assistive use.
                          onClick={() => onSelect(field)}
                          onMouseDown={() => onSelect(field)}
                          title={`${field.description}\n\nExample: ${field.example}`}
                          data-selected={isSelected ? true : undefined}
                          className={cn(
                            'group flex w-full flex-col items-start rounded-[2px] px-2 py-1.5 text-left transition-colors',
                            'hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
                            isSelected && 'bg-muted ring-1 ring-primary/40',
                          )}
                        >
                          <span className="font-normal text-foreground text-xs">{field.label}</span>
                          <span className="line-clamp-1 w-full text-[0.6875rem] text-muted-foreground">
                            {field.example.split('\n')[0]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
