/**
 * Lives in its own module rather than beside the component that used to export
 * it: a file that exports both a component and a plain function breaks React
 * Fast Refresh, which is what `react-refresh/only-export-components` flags.
 */

/** Case-insensitive union of manually typed and AI-extracted tags. */
export function mergeTags(current: string[], extracted: string[]): string[] {
  const seen = new Set(current.map((t) => t.toLowerCase()))
  const merged = [...current]
  for (const tag of extracted) {
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
      merged.push(tag)
    }
  }
  return merged
}
