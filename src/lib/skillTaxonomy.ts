/**
 * Skill taxonomy: a parent-child map of skills, plus a directional scorer.
 *
 * Why a tree instead of the old flat clusters: skill credit is not symmetric.
 * A student who knows "Embedded C" clearly does "Embedded Systems" work, but a
 * student who only claims "Embedded Systems" tells us very little about whether
 * they can write Embedded C. Flat clusters scored both directions the same and
 * so could not express that difference.
 *
 * Edges are stored child -> parents. Children are derived at load time.
 * A skill may have several parents ("ESP32" is both a microcontroller and IoT
 * hardware), which is why this is a graph, not a strict tree.
 */

import generated from './skillEdges.generated.json' with { type: 'json' }

const GENERATED_PARENTS: Record<string, string[]> = generated.edges ?? {}

/** Hand-written seed taxonomy. Trusted; never overwritten by generated edges. */
export const SEED_PARENTS: Record<string, string[]> = {
  // --- roots ---
  'software development': [],
  'hardware engineering': [],
  'data': [],
  'infrastructure': [],

  // --- embedded / firmware ---
  'embedded systems': ['software development', 'hardware engineering'],
  'embedded software': ['embedded systems'],
  'embedded c': ['embedded systems', 'c/c++'],
  'firmware': ['embedded systems'],
  'firmware development': ['firmware'],
  'microcontroller': ['embedded systems'],
  'microcontroller programming': ['microcontroller'],
  'rtos': ['embedded systems'],
  'arm cortex m': ['microcontroller'],
  'arm': ['microcontroller'],
  'esp32': ['microcontroller', 'iot'],
  'arduino': ['microcontroller'],
  'raspberry pi': ['microcontroller'],
  'uart': ['embedded systems'],
  'spi': ['embedded systems'],
  'i2c': ['embedded systems'],

  // --- languages ---
  'c/c++': ['software development'],
  'c++': ['c/c++'],
  'c': ['c/c++'],
  'python': ['software development'],
  'java': ['software development'],
  'c#': ['software development', '.net'],
  '.net': ['backend development'],
  'javascript': ['software development'],
  'typescript': ['javascript'],
  // SQL is genuinely both a backend and a data-analysis skill; listing both
  // parents is what connects the data branch to the backend branch.
  'sql': ['databases', 'data analytics'],

  // --- electronics ---
  'pcb design': ['hardware engineering'],
  'printed circuit board': ['pcb design'],
  'electronics design': ['hardware engineering'],
  'kicad': ['pcb design'],
  'altium designer': ['pcb design'],
  'schematic capture': ['pcb design'],
  'electrical schematics': ['electronics design'],
  'soldering': ['electronics design'],
  'dfm': ['pcb design'],

  // --- robotics ---
  'robotics': ['embedded systems'],
  'robotics software': ['robotics'],
  'ros': ['robotics'],
  'control systems': ['robotics'],
  'computer vision': ['machine learning'],
  'opencv': ['computer vision'],

  // --- iot ---
  'iot': ['embedded systems'],
  'internet of things': ['iot'],
  'mqtt': ['iot', 'networking'],
  'aws iot': ['iot'],

  // --- data / ml ---
  'data analytics': ['data'],
  'data analysis': ['data analytics'],
  'statistics': ['data'],
  'excel': ['data analytics'],
  'root cause analysis': ['data analysis'],
  'machine learning': ['data', 'software development'],
  'artificial intelligence': ['machine learning'],
  'edge ai': ['machine learning', 'embedded systems'],
  'tensorflow lite': ['machine learning'],
  'model optimization': ['machine learning'],

  // --- networking ---
  'networking': ['infrastructure'],
  'network engineering': ['networking'],
  'ccna': ['networking'],
  'tcp/ip': ['networking'],
  'cisco ios': ['networking'],
  'network security': ['networking'],
  'wireshark': ['networking'],

  // --- rf / telecom ---
  'rf engineering': ['hardware engineering'],
  'telecommunications': ['rf engineering'],
  'rf fundamentals': ['rf engineering'],
  'spectrum analysis': ['rf engineering'],
  'lte/5g': ['telecommunications'],
  'matlab': ['data'],
  'site survey': ['telecommunications'],

  // --- industrial automation ---
  'automation': ['automation engineering'],
  'automation engineering': ['hardware engineering'],
  'plc': ['automation engineering'],
  'ladder logic': ['plc'],
  'scada': ['automation engineering'],
  'hmi': ['automation engineering'],

  // --- web ---
  'frontend development': ['software development'],
  'frontend': ['frontend development'],
  'react': ['frontend development', 'javascript'],
  'html': ['frontend development'],
  'css': ['frontend development'],
  'ui/ux design': ['frontend development'],
  'figma': ['ui/ux design'],
  'backend development': ['software development'],
  'backend': ['backend development'],
  'node js': ['backend development', 'javascript'],
  'api development': ['backend development'],
  'databases': ['backend development', 'data'],

  // --- tooling: the gap that made Git score 0 against everyone ---
  'version control': ['software development'],
  'git': ['version control'],
  'github': ['git'],
  'gitlab': ['git'],
  'devops': ['infrastructure'],
  'ci/cd': ['devops'],
  'docker': ['containers'],
  'containers': ['devops'],
  'containerization': ['containers'],
  'kubernetes': ['containers'],
  'linux': ['infrastructure'],
  'bash': ['linux'],
  'shell scripting': ['bash'],
  // --- course names: students list these straight off their transcript ---
  // Deliberately attached high in the tree. A course title is weaker evidence
  // than a claimed skill, and hanging it off a root keeps the credit modest.
  'data structures and algorithms': ['software development'],
  'algorithms': ['software development'],
  'object oriented programming': ['software development'],
  'computer organization': ['hardware engineering'],
  'operating systems': ['software development'],

  'agile': ['software development'],
  'scrum': ['agile'],
  'jira': ['agile'],
}

/** How much credit each kind of relationship earns, before hop decay. */
const WEIGHTS = {
  /** Student's skill sits BELOW what's required: specialist proves the general. */
  descendant: 0.88,
  /** Student's skill sits ABOVE what's required: a broad claim, weak evidence. */
  ancestor: 0.35,
  /** Same parent — React vs Vue. Transferable, not equivalent. */
  sibling: 0.62,
  /**
   * Related only via a root ("both are software"). Python vs C/C++ — real, but
   * it says little more than "this person programs".
   */
  rootSibling: 0.22,
}

/** Each extra hop of distance shrinks the credit. */
const DECAY = { descendant: 0.82, ancestor: 0.55, sibling: 0.78 }

/** Beyond this many hops, two skills are not meaningfully related. */
const MAX_HOPS = 4

/**
 * Cousins need more room than ancestors: "Firmware Development" and "Arduino"
 * are four hops apart via "Embedded Systems", yet anyone hiring for an embedded
 * role would count one toward the other.
 */
const MAX_SIBLING_DISTANCE = 4

/** Generated edges are scored lower than hand-written ones until reviewed. */
const GENERATED_TRUST = 0.85

/**
 * Different spellings of the same skill. Applied after basic normalisation, so
 * "React.js" and "Type-Script" have already become "react js" / "type script"
 * by the time they get here.
 *
 * Students write abbreviations constantly; without this, "JS" scored 0 against
 * "JavaScript".
 */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  'type script': 'typescript',
  'react js': 'react',
  reactjs: 'react',
  node: 'node js',
  nodejs: 'node js',
  ml: 'machine learning',
  ai: 'artificial intelligence',
  cv: 'computer vision',
  oop: 'object oriented programming',
  'object oriented': 'object oriented programming',
  dsa: 'data structures and algorithms',
  db: 'databases',
  database: 'databases',
  k8s: 'kubernetes',
  vcs: 'version control',
  'source control': 'version control',
  'ui ux': 'ui/ux design',
  'ui/ux': 'ui/ux design',
  'c sharp': 'c#',
  csharp: 'c#',
  'dot net': '.net',
  dotnet: '.net',
  cpp: 'c++',
  'embedded c++': 'embedded c',
  'micro controller': 'microcontroller',
  'raspberry pi 4': 'raspberry pi',
}

export function normalizeSkill(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
  return ALIASES[base] ?? base
}

type Graph = {
  parents: Map<string, string[]>
  children: Map<string, string[]>
  generated: Set<string>
}

function buildGraph(): Graph {
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  const generated = new Set<string>()

  const add = (rawChild: string, rawParents: string[], isGenerated: boolean) => {
    const child = normalizeSkill(rawChild)
    if (!child) return
    // Seed edges win: a generated edge never overwrites a reviewed one.
    if (isGenerated && parents.has(child)) return
    if (isGenerated) generated.add(child)

    const list = rawParents.map(normalizeSkill).filter((p) => p && p !== child)
    parents.set(child, list)
    for (const parent of list) {
      if (!children.has(parent)) children.set(parent, [])
      children.get(parent)!.push(child)
    }
  }

  for (const [child, list] of Object.entries(SEED_PARENTS)) add(child, list, false)
  for (const [child, list] of Object.entries(GENERATED_PARENTS)) add(child, list, true)

  return { parents, children, generated }
}

const GRAPH = buildGraph()

/** A top-level domain with no parent of its own — too broad to imply anything. */
function isRoot(skill: string): boolean {
  return (GRAPH.parents.get(skill) ?? []).length === 0
}

export function isKnownSkill(skill: string): boolean {
  const s = normalizeSkill(skill)
  return GRAPH.parents.has(s) || GRAPH.children.has(s)
}

/** Walk `direction` from `start`, returning each reachable skill and its hop count. */
function reachable(start: string, direction: 'parents' | 'children'): Map<string, number> {
  const seen = new Map<string, number>([[start, 0]])
  let frontier = [start]

  for (let hop = 1; hop <= MAX_HOPS && frontier.length; hop++) {
    const next: string[] = []
    for (const node of frontier) {
      for (const neighbour of GRAPH[direction].get(node) ?? []) {
        if (seen.has(neighbour)) continue
        seen.set(neighbour, hop)
        next.push(neighbour)
      }
    }
    frontier = next
  }

  seen.delete(start)
  return seen
}

function trust(...skills: string[]): number {
  return skills.some((s) => GRAPH.generated.has(s)) ? GENERATED_TRUST : 1
}

/**
 * Directional relatedness between one student skill and one required skill.
 * Returns 0..1. Direction matters: see the note at the top of this file.
 */
export function taxonomyScore(studentSkill: string, requiredSkill: string): number {
  const mine = normalizeSkill(studentSkill)
  const need = normalizeSkill(requiredSkill)
  if (!mine || !need) return 0
  if (mine === need) return 1
  if (!isKnownSkill(mine) || !isKnownSkill(need)) return 0

  let best = 0

  // Student's skill is a descendant of the requirement (C# under Software Dev).
  const belowNeed = reachable(need, 'children')
  if (belowNeed.has(mine)) {
    const hops = belowNeed.get(mine)!
    best = Math.max(best, WEIGHTS.descendant * DECAY.descendant ** (hops - 1))
  }

  // Student's skill is an ancestor of the requirement (Software Dev over C#).
  //
  // How much a broad claim implies a specific one depends on how broad it
  // really is. "Version Control" has essentially one child, so claiming it
  // does strongly imply Git. "Software Development" has dozens, so it implies
  // almost nothing about C# in particular.
  const aboveNeed = reachable(need, 'parents')
  if (aboveNeed.has(mine)) {
    const hops = aboveNeed.get(mine)!
    const breadth = (GRAPH.children.get(mine) ?? []).length
    const boost = breadth <= 1 ? 2 : breadth <= 3 ? 1.4 : 1
    best = Math.max(best, Math.min(0.8, WEIGHTS.ancestor * DECAY.ancestor ** (hops - 1) * boost))
  }

  // Siblings/cousins: both descend from a shared ancestor.
  //
  // The shared ancestor has to be specific enough to mean something. Everything
  // in the tree descends from a root like "Software Development", so routing
  // sibling credit through a root would make Version Control look like evidence
  // of C/C++. Root-level kinship earns only a token amount.
  const aboveMine = reachable(mine, 'parents')
  for (const [ancestor, myHops] of aboveMine) {
    const needHops = aboveNeed.get(ancestor)
    if (needHops === undefined) continue
    const distance = myHops + needHops
    if (distance > MAX_SIBLING_DISTANCE) continue

    const score = isRoot(ancestor)
      ? WEIGHTS.rootSibling
      : WEIGHTS.sibling * DECAY.sibling ** (distance - 2)
    best = Math.max(best, score)
  }

  return Math.min(1, best * trust(mine, need))
}
