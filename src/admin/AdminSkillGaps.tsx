import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { AdSearch } from './components'
import { fetchSkillGaps } from './adminQueries'
import { useRealtimeRefresh } from '../lib/realtime'
import type { AdminSkillGap } from './adminData'

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * The skills the matcher could not place.
 *
 * These used to accumulate in each student's own localStorage, where nobody
 * could reach them. Anything listed here currently scores 0 against every
 * listing that asks for it, so this page is the to-do list for
 * `npm run skills:learn`.
 */
export function AdminSkillGaps() {
  const [gaps, setGaps] = useState<AdminSkillGap[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  /** Bumped by Refresh; re-runs the fetch below. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const rows = await fetchSkillGaps()
        if (!cancelled) setGaps(rows)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the skill backlog.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  // Backlog rows are written by students' matchers as they upload resumes —
  // fold them in as they land rather than waiting for a manual Refresh.
  const refreshGaps = useCallback(async () => {
    setGaps(await fetchSkillGaps())
  }, [])
  useRealtimeRefresh(['skill_gaps'], refreshGaps)

  const filtered = useMemo(
    () => gaps.filter((g) => g.skill.includes(search.trim().toLowerCase())),
    [gaps, search],
  )

  /** Exactly the shape `npm run skills:learn -- --file gaps.json` expects. */
  const copyAsJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(gaps.map((g) => g.skill), null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setLoadError('Could not copy to the clipboard.')
    }
  }

  return (
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Skill Backlog</h1>
          <p className="ic-subtitle">
            {loading ? 'Loading…' : `${gaps.length} skill${gaps.length === 1 ? '' : 's'} the matcher does not recognise`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ic-secondary" onClick={() => setReloadKey((k) => k + 1)} type="button">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="ic-primary" disabled={!gaps.length} onClick={() => void copyAsJson()} type="button">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy as JSON'}
          </button>
        </div>
      </div>

      <p className="ic-muted" style={{ margin: '0 0 16px', maxWidth: '70ch' }}>
        Anything here scores 0 against every listing that asks for it. Copy the list to a
        <code> gaps.json</code> file and run <code>npm run skills:learn -- --file gaps.json</code> to
        teach the matcher where these belong.
      </p>

      <div className="ic-toolbar">
        <AdSearch onChange={setSearch} placeholder="Search skills…" value={search} />
      </div>

      {loadError && <div className="ic-card ic-empty">{loadError}</div>}

      {!loadError && (
        <div className="ic-table-wrap">
          <table className="ic-table">
            <thead>
              <tr>
                {['Skill', 'Times seen', 'First seen', 'Last seen'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.skill}>
                  <td>{g.skill}</td>
                  <td className="ic-muted">{g.timesSeen}</td>
                  <td className="ic-muted">{shortDate(g.firstSeen)}</td>
                  <td className="ic-muted">{shortDate(g.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !filtered.length && (
            <div className="ic-card ic-empty">
              {gaps.length ? 'No skills match that search' : 'Nothing unrecognised yet'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
