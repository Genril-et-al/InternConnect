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

function tokens(value: string): string[] {
  return value.match(/[a-z0-9+#]+/g) ?? []
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function phraseSpecificity(value: string): number {
  return Math.min(tokens(value).length / 4, 1)
}

/**
 * The cluster terms, normalised and pre-compiled once at module load.
 *
 * This used to be done inside relatedSkillScore, which meant every skill pair
 * re-normalised all ~100 terms and built a fresh RegExp for each. A student
 * with 10 skills against 160 listings is ~9,600 pairs, so that came to roughly
 * two million RegExp constructions per page load — about 2s of blocked main
 * thread once the demo data grew. The terms are static, so none of it needs to
 * happen more than once.
 */
type ClusterTerm = { pattern: RegExp; specificity: number; tokens: string[]; tokenSet: Set<string> }

const NORMALIZED_GROUPS: ClusterTerm[][] = RELATED_SKILL_GROUPS.map((group) =>
  group.map((raw) => {
    const term = normalizeSkill(raw)
    const termTokens = tokens(term)
    return {
      pattern: new RegExp(`(^|\\W)${escapeRegExp(term)}(\\W|$)`),
      specificity: phraseSpecificity(term),
      tokens: termTokens,
      tokenSet: new Set(termTokens),
    }
  }),
)

function tokenOverlapScore(a: ClusterTerm, b: ClusterTerm): number {
  if (!a.tokenSet.size || !b.tokens.length) return 0
  const shared = b.tokens.filter((token) => a.tokenSet.has(token)).length
  return shared / Math.max(a.tokenSet.size, b.tokens.length)
}

function relatedSkillScore(profileSkill: string, listingSkill: string): number {
  let best = 0
  for (const group of NORMALIZED_GROUPS) {
    const profileTerms = group.filter((term) => term.pattern.test(profileSkill))
    if (!profileTerms.length) continue

    const listingTerms = group.filter((term) => term.pattern.test(listingSkill))
    if (!listingTerms.length) continue

    for (const profileTerm of profileTerms) {
      for (const listingTerm of listingTerms) {
        const score =
          0.45 +
          profileTerm.specificity * 0.16 +
          listingTerm.specificity * 0.16 +
          tokenOverlapScore(profileTerm, listingTerm) * 0.18
        best = Math.max(best, clampScore(score))
      }
    }
  }
  return best
}

/**
 * Skills seen in real listings/profiles that the taxonomy cannot place.
 * This is the backlog `npm run skills:learn` works through.
 *
 * localStorage is the de-duplication record, not the destination: it is what
 * stops the same skill being reported on every page load. The list itself goes
 * to the server through the sink below, because a backlog sitting in each
 * student's own browser is one nobody can ever collect.
 */
const GAP_KEY = 'internconnect.skillGaps'

type GapSink = (skill: string) => void
let gapSink: GapSink | null = null

/**
 * Where newly-seen unknown skills are reported. Left unset here on purpose —
 * this module must stay free of Supabase so it can run from a plain script
 * (see the note at the top). The app installs the real sink at startup;
 * scripts simply never install one.
 */
export function setSkillGapSink(sink: GapSink | null): void {
  gapSink = sink
}

/**
 * In-memory mirror of the stored gap list, so the common case (a skill we have
 * already logged) costs a Set lookup instead of a localStorage read plus a
 * JSON.parse of up to 500 entries. Matching calls this once per skill per
 * listing — thousands of times a load — and localStorage is synchronous, so the
 * old read-every-time version showed up directly in load time.
 */
let gapCache: Set<string> | null = null

function loadGaps(): Set<string> {
  if (gapCache) return gapCache
  try {
    gapCache = new Set<string>(JSON.parse(localStorage.getItem(GAP_KEY) ?? '[]'))
  } catch {
    gapCache = new Set<string>()
  }
  return gapCache
}

export function recordSkillGap(skill: string): void {
  const s = normalizeSkill(skill)
  if (!s || isKnownSkill(s)) return

  const gaps = loadGaps()
  if (gaps.has(s)) return
  gaps.add(s)

  gapSink?.(s)

  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(GAP_KEY, JSON.stringify([...gaps].slice(-500)))
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
 * Scoring one pair is pure, and the same pairs recur constantly — one student's
 * skills are scored against every listing on the board, and listings share
 * skills heavily. This cache turns thousands of calls into a few hundred.
 * Bounded because the skill vocabulary is open-ended (students type free text);
 * at the cap we stop adding rather than evict, since scoring stays correct
 * either way.
 */
const PAIR_CACHE_LIMIT = 20_000
const pairCache = new Map<string, number>()

/**
 * How well ONE student skill covers ONE required skill, 0..1.
 * Best of: exact match, the taxonomy, a substring hit, the legacy clusters.
 */
export function pairScore(studentSkill: string, requiredSkill: string): number {
  const mine = normalizeSkill(studentSkill)
  const need = normalizeSkill(requiredSkill)
  if (!mine || !need) return 0
  if (mine === need) return 1

  // NUL is a collision-free separator; a space is not, because normalised
  // skills contain spaces ("node js" + "react" vs "node" + "js react").
  const key = `${mine}\0${need}`
  const cached = pairCache.get(key)
  if (cached !== undefined) return cached

  const score = computePairScore(mine, need)
  if (pairCache.size < PAIR_CACHE_LIMIT) pairCache.set(key, score)
  return score
}

/** The actual scorer. Inputs are already normalised and known to differ. */
function computePairScore(mine: string, need: string): number {
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
