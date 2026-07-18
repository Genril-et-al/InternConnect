/**
 * The system stores middle *initials* only — the sign-up field is capped at
 * four characters ("S." or "S.J."), never a full middle name. This normalises
 * whatever was entered into the canonical form: uppercase, one period per
 * initial ("s" and "S" both become "S.").
 *
 * Normalising at the point of entry means the period is also baked into
 * full_name, which the database composes from the stored first/middle/last
 * columns.
 *
 * The admin CSV import has no length limit on its `middle` column, so a roster
 * may still arrive with a spelled-out middle name. Since the column only holds
 * an initial, each part is reduced to its first letter — "Santos" is stored as
 * "S.".
 */
export function formatMiddleInitial(mi: string | null | undefined): string {
  // Periods become separators so "S.J" and "S J" are read the same way, then
  // exactly one period is re-added per initial.
  const parts = (mi ?? '')
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return parts.map((part) => `${part[0].toUpperCase()}.`).join(' ')
}
