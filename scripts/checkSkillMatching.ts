/**
 * Ground-truth check for skill matching.  Run: npm run skills:check
 *
 * Every case in skillCases.json is a real-ish student/listing pair labelled by
 * a human as good / partial / bad. This script scores each one and reports
 * whether the number lands in the expected band.
 *
 * This is what stands in for a human reviewer once the AI generator is writing
 * edges on its own: if a generated batch makes matching worse, this fails.
 *
 * Exits non-zero on any failure, so it can gate a commit or a taxonomy update.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { computeMatch, pairScore } from '../src/lib/skillMatch.ts'

type Label = 'good' | 'partial' | 'bad'
type Case = { name: string; student: string[]; required: string[]; expect: Label }

/** What each human label means as a percentage range. */
const BANDS: Record<Label, [number, number]> = {
  good: [65, 100],
  partial: [25, 64],
  bad: [0, 24],
}

const here = dirname(fileURLToPath(import.meta.url))
const cases: Case[] = JSON.parse(readFileSync(join(here, 'skillCases.json'), 'utf8'))

const verbose = process.argv.includes('--verbose')
let passed = 0
const failures: string[] = []

for (const c of cases) {
  const score = computeMatch(c.student, c.required)
  const [min, max] = BANDS[c.expect]
  const ok = score !== null && score >= min && score <= max

  if (ok) passed++
  else failures.push(`${c.name}: got ${score}%, expected ${c.expect} (${min}-${max}%)`)

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(score).padStart(4)}%  ${c.expect.padEnd(7)} ${c.name}`)

  if (verbose) {
    for (const need of c.required) {
      const best = c.student
        .map((mine) => ({ mine, score: pairScore(mine, need) }))
        .sort((a, b) => b.score - a.score)[0]
      const via = best && best.score > 0 ? `${best.mine} (${best.score.toFixed(2)})` : 'nothing'
      console.log(`        ${need.padEnd(22)} <- ${via}`)
    }
  }
}

const pct = Math.round((passed / cases.length) * 100)
console.log(`\n${passed}/${cases.length} cases passed (${pct}%)`)

if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
