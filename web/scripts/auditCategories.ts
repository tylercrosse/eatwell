/**
 * Category audit — runs the resolver over the seeded persona foods and reports where it
 * lands, so coarse buckets surface and KEYWORD_RULES can be tuned (data, not code).
 *
 *   cd web && npx tsx scripts/auditCategories.ts
 *
 * Flags rows that resolve only to a Tier-1 *group* (no specific Tier-2) or to a generic
 * fallback — those are the candidates for new Tier-2 keys/keywords in the next wave.
 */
import { FOOD_GENERIC, groupOf, isGroup, resolveCategory } from '../src/lib/foodCategory'
import { SEED_FOOD_NAMES } from '../src/lib/foodCategory.fixtures'

const rows = SEED_FOOD_NAMES.map((name) => {
  const cat = resolveCategory({ food_name: name })
  return { name, cat, group: groupOf(cat) ?? cat, tier: isGroup(cat) ? 'group' : 'tier2' }
})

const pad = (s: string, n: number) => s.padEnd(n)
console.log(pad('FOOD', 34), pad('CATEGORY', 22), 'GROUP')
console.log('-'.repeat(70))
for (const r of rows) {
  const flag = r.cat === FOOD_GENERIC ? ' ⚠ generic' : r.tier === 'group' ? ' · group-only' : ''
  console.log(pad(r.name, 34), pad(r.cat, 22), r.group + flag)
}

const byGroup = new Map<string, number>()
for (const r of rows) byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + 1)
const groupOnly = rows.filter((r) => r.tier === 'group').length
const generic = rows.filter((r) => r.cat === FOOD_GENERIC).length

console.log('\nGroup histogram:')
for (const [g, n] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(g, 16)} ${'█'.repeat(n)} ${n}`)
}
console.log(
  `\n${rows.length} foods · ${groupOnly} group-only (${Math.round((100 * groupOnly) / rows.length)}%) · ${generic} generic`,
)
