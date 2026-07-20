/**
 * Skill matching: turns a student's skills and a listing's required skills into
 * a single match percentage. Deliberately has NO Supabase import, so it can be
 * run straight from a script (see scripts/checkSkillMatching.ts).
 *
 * The scorer is pure and deterministic: same inputs always give the same
 * number. No AI runs here. The AI only ever edits the taxonomy, offline.
 */

import { isKnownSkill, normalizeSkill, taxonomyScore } from './skillTaxonomy'

/**
 * The previous flat-cluster model. Kept only as a safety net for skills the
 * taxonomy has not learned yet — it is symmetric and therefore cannot tell a
 * specialist from a generalist, which is why the taxonomy takes priority.
 */
const RELATED_SKILL_GROUPS = [
  [
    'embedded systems',
    'embedded software',
    'embedded c',
    'firmware',
    'firmware development',
    'microcontroller',
    'arm cortex-m',
    'arm',
    'rtos',
    'uart',
    'spi',
    'i2c',
    'esp32',
    'arduino',
    'raspberry pi',
    'c/c++',
    'c++',
  ],
  [
    'pcb design',
    'printed circuit board',
    'electronics design',
    'kicad',
    'altium designer',
    'schematic capture',
    'dfm',
    'soldering',
    'electrical schematics',
  ],
  ['robotics', 'robotics software', 'ros', 'computer vision', 'opencv', 'automation', 'control systems'],
  ['iot', 'internet of things', 'mqtt', 'aws iot', 'esp32', 'node.js', 'embedded systems'],
  ['data analytics', 'data analysis', 'statistics', 'excel', 'root cause analysis'],
  ['machine learning', 'artificial intelligence', 'edge ai', 'tensorflow lite', 'model optimization'],
  ['networking', 'network engineering', 'ccna', 'tcp/ip', 'cisco ios', 'network security', 'wireshark'],
  ['rf engineering', 'telecommunications', 'rf fundamentals', 'spectrum analysis', 'lte/5g', 'matlab', 'site survey'],
  ['automation engineering', 'plc', 'ladder logic', 'scada', 'hmi', 'electrical schematics'],
  ['frontend development', 'frontend', 'react', 'typescript', 'javascript', 'html', 'css', 'ui/ux design', 'figma'],
  ['backend development', 'backend', 'node.js', 'api development', 'databases', 'sql'],
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesWholePhrase(value: string, phrase: string): boolean {
  return new RegExp(`(^|\\W)${escapeRegExp(phrase)}(\\W|$)`).test(value)
}

function tokens(value: string): string[] {
  return value.match(/[a-z0-9+#]+/g) ?? []
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(tokens(a))
  const bTokens = tokens(b)
  if (!aTokens.size || !bTokens.length) return 0
  const shared = bTokens.filter((token) => aTokens.has(token)).length
  return shared / Math.max(aTokens.size, bTokens.length)
}

function phraseSpecificity(value: string): number {
  return Math.min(tokens(value).length / 4, 1)
}

function relatedSkillScore(profileSkill: string, listingSkill: string): number {
  let best = 0
  for (const group of RELATED_SKILL_GROUPS) {
    const profileTerms = group.map(normalizeSkill).filter((term) => includesWholePhrase(profileSkill, term))
    if (!profileTerms.length) continue

    const listingTerms = group.map(normalizeSkill).filter((term) => includesWholePhrase(listingSkill, term))
    if (!listingTerms.length) continue

    for (const profileTerm of profileTerms) {
      for (const listingTerm of listingTerms) {
        const score =
          0.45 +
          phraseSpecificity(profileTerm) * 0.16 +
          phraseSpecificity(listingTerm) * 0.16 +
          tokenOverlapScore(profileTerm, listingTerm) * 0.18
        best = Math.max(best, clampScore(score))
      }
    }
  }
  return best
}

/**
 * Skills seen in real listings/profiles that the taxonomy cannot place.
 * This is the backlog `npm run skills:learn` works through. Stored in
 * localStorage, so it costs nothing and needs no table.
 */
const GAP_KEY = 'internconnect.skillGaps'

export function recordSkillGap(skill: string): void {
  const s = normalizeSkill(skill)
  if (!s || isKnownSkill(s)) return
  if (typeof localStorage === 'undefined') return
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(GAP_KEY) ?? '[]')
    if (existing.includes(s)) return
    localStorage.setItem(GAP_KEY, JSON.stringify([...existing, s].slice(-500)))
  } catch {
    // Private mode / quota — the gap log is best-effort, never break matching.
  }
}

/** Everything the taxonomy could not place. Feed this to the generator. */
export function skillGaps(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(GAP_KEY) ?? '[]')
  } catch {
    return []
  }
}

/**
 * How well ONE student skill covers ONE required skill, 0..1.
 * Best of: exact match, the taxonomy, a substring hit, the legacy clusters.
 */
export function pairScore(studentSkill: string, requiredSkill: string): number {
  const mine = normalizeSkill(studentSkill)
  const need = normalizeSkill(requiredSkill)
  if (!mine || !need) return 0
  if (mine === need) return 1

  const viaTaxonomy = taxonomyScore(mine, need)

  // Substring is a weak signal ("MQTT" inside "MQTT Protocols" is a real hit,
  // but "design" inside "graphic design" is not), so it is capped below 1.
  const viaSubstring =
    (mine.length > 3 && need.includes(mine)) || (need.length > 3 && mine.includes(need)) ? 0.8 : 0

  return Math.max(viaTaxonomy, viaSubstring, relatedSkillScore(mine, need))
}

/**
 * How much each additional use of the same student skill is worth.
 * First use 100%, second 55%, third 30%, and so on.
 */
const REUSE_DECAY = 0.7

/**
 * Total coverage of a listing's requirements.
 *
 * Each required skill is satisfied at most once, by its best available match.
 * A student skill MAY cover several requirements — "Embedded Systems" really
 * does say something about ESP32, C/C++ and Arduino — but each reuse is worth
 * progressively less. A hard one-use-only rule was too harsh: it capped any
 * student who had fewer skills listed than the job asked for, no matter how
 * well those skills fit.
 *
 * Pairs are taken strongest-first, so the best fit is always credited at full
 * value and the weaker leftovers absorb the decay.
 */
export function coverageTotal(profileSkills: string[], listingSkills: string[]): number {
  const pairs: { student: number; required: number; score: number }[] = []
  profileSkills.forEach((student, si) => {
    listingSkills.forEach((required, ri) => {
      const score = pairScore(student, required)
      if (score > 0) pairs.push({ student: si, required: ri, score })
    })
  })
  pairs.sort((a, b) => b.score - a.score)

  const timesUsed = new Map<number, number>()
  const satisfied = new Set<number>()
  let total = 0

  for (const pair of pairs) {
    if (satisfied.has(pair.required)) continue
    const used = timesUsed.get(pair.student) ?? 0
    satisfied.add(pair.required)
    timesUsed.set(pair.student, used + 1)
    total += pair.score * REUSE_DECAY ** used
  }
  return total
}

/**
 * Skills-overlap match %, or null when there is nothing to score against —
 * either the student has no skills on file or the listing lists no
 * requirements. Null renders as "unknown"; 0% would read as a genuine bad fit.
 *
 * The student pool is everything on their profile: AI-extracted resume skills,
 * manually added skills, and specializations.
 */
export function computeMatch(studentPool: string[], listingSkills: string[]): number | null {
  const mine = studentPool.map(normalizeSkill).filter(Boolean)
  const need = listingSkills.map(normalizeSkill).filter(Boolean)
  if (!mine.length || !need.length) return null

  for (const skill of [...mine, ...need]) recordSkillGap(skill)

  return Math.round((coverageTotal(mine, need) / need.length) * 100)
}

/** The full matching pool for a student profile: skills + specializations. */
export function matchPool(skills?: string[] | null, specializations?: string[] | null): string[] {
  return [...(skills ?? []), ...(specializations ?? [])]
}
