/**
 * Ships the skill backlog to the server.
 *
 * `recordSkillGap` fires once per unknown skill per browser — cheap, but the
 * result used to live only in that student's localStorage, so the backlog
 * `npm run skills:learn` needs was spread across every student's own device
 * with no way to gather it. This drains those reports into `skill_gaps`.
 *
 * Kept separate from skillMatch.ts so that module stays Supabase-free and can
 * still be imported by the scripts.
 */

import { supabase } from './supabase'
import { setSkillGapSink } from './skillMatch'

/**
 * Unknown skills arrive in bursts — one page of listings scores hundreds of
 * pairs at once — so they are batched rather than sent one request each.
 */
const FLUSH_DELAY_MS = 3_000

/** Matches the cap in record_skill_gaps(); anything above it is dropped there. */
const MAX_BATCH = 100

const pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let installed = false

async function flush(): Promise<void> {
  timer = null
  if (!pending.size) return

  const batch = [...pending].slice(0, MAX_BATCH)
  for (const skill of batch) pending.delete(skill)

  const { error } = await supabase.rpc('record_skill_gaps', { p_skills: batch })
  if (error) {
    // Logging the backlog is housekeeping; it must never surface to a student
    // or interrupt matching. The skills stay in localStorage either way.
    console.warn('[skillGaps] could not report backlog:', error.message)
    return
  }

  if (pending.size) schedule()
}

function schedule(): void {
  if (timer) return
  timer = setTimeout(() => void flush(), FLUSH_DELAY_MS)
}

/** Start forwarding unknown skills to the server. Safe to call more than once. */
export function startSkillGapSync(): void {
  if (installed) return
  installed = true
  setSkillGapSink((skill) => {
    pending.add(skill)
    schedule()
  })
}
