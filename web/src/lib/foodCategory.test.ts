import { describe, expect, it } from 'vitest'
import {
  BEVERAGE_GENERIC,
  FOOD_GENERIC,
  GROUP_KEYS,
  TIER2_PARENTS,
  groupOf,
  isGroup,
  keywordCategory,
  resolveCategory,
} from './foodCategory'
import { iconFor } from './foodCategoryIcons'
import { SEED_FOOD_NAMES } from './foodCategory.fixtures'

describe('taxonomy invariants', () => {
  it('every Tier-2 key has a real parent group', () => {
    for (const [key, parent] of Object.entries(TIER2_PARENTS)) {
      expect(GROUP_KEYS, `${key} -> ${parent}`).toContain(parent)
    }
  })

  it('every group and Tier-2 key resolves to an icon component', () => {
    // lucide v1 icons are forwardRef objects, so assert a renderable component (not undefined).
    for (const key of [...GROUP_KEYS, ...Object.keys(TIER2_PARENTS), FOOD_GENERIC, BEVERAGE_GENERIC]) {
      expect(iconFor(key), key).toBeTruthy()
    }
  })

  it('groupOf maps a group to itself and a Tier-2 to its parent', () => {
    expect(groupOf('bowl')).toBe('bowl')
    expect(groupOf('croissant')).toBe('pastry')
    expect(isGroup('bowl')).toBe(true)
    expect(isGroup('croissant')).toBe(false)
  })
})

describe('keyword matching is whole-word', () => {
  it('does not match "egg" inside "eggplant"', () => {
    // 'eggplant' is a vegetable, never the egg protein.
    expect(groupOf(keywordCategory('grilled eggplant') ?? '')).toBe('vegetables')
  })

  it('routes composed dishes by their form, not a stray ingredient', () => {
    expect(keywordCategory('chicken caesar salad')).toBe('protein_salad') // not poultry
    expect(keywordCategory('chicken burrito bowl')).toBe('rice_bowl') // not burrito
    expect(keywordCategory('smoothie bowl')).toBe('acai_smoothie_bowl') // not a smoothie drink
    expect(keywordCategory('milkshake')).toBe('milk_drink') // not milk (dairy)
  })
})

describe('resolveCategory cascade', () => {
  it('a barcode Tier-2 category wins outright', () => {
    expect(resolveCategory({ food_name: 'Acme Fizzy', category: 'soda' })).toBe('soda')
  })

  it('AI group + agreeing keyword yields the specific Tier-2', () => {
    expect(resolveCategory({ food_name: 'chicken caesar salad', category: 'salad' })).toBe('protein_salad')
  })

  it('AI group disambiguates a conflicting keyword (trusts the group)', () => {
    // "milk" keyword -> dairy, but the AI says it's a cold drink: trust the drink vessel.
    expect(resolveCategory({ food_name: 'oat milk', category: 'cold_drink' })).toBe('cold_drink')
    // A wrong-but-plausible keyword loses to the AI's semantic group.
    expect(resolveCategory({ food_name: 'chicken caesar salad', category: 'soup_stew' })).toBe('soup_stew')
  })

  it('falls back to the AI group when no keyword matches', () => {
    expect(resolveCategory({ food_name: 'grandmas special', category: 'plate' })).toBe('plate')
  })

  it('uses a neutral generic when nothing is confident', () => {
    expect(resolveCategory({ food_name: 'xyzzy' })).toBe(FOOD_GENERIC)
    expect(resolveCategory({ food_name: 'xyzzy', is_beverage: true })).toBe(BEVERAGE_GENERIC)
  })

  it('classifies the example probes by visual form', () => {
    expect(groupOf(resolveCategory({ food_name: 'croissant' }) )).toBe('pastry')
    expect(groupOf(resolveCategory({ food_name: 'acai bowl' }))).toBe('bowl')
    expect(groupOf(resolveCategory({ food_name: 'eggplant parmesan' }))).toBe('plate')
    expect(groupOf(resolveCategory({ food_name: 'plate of thanksgiving food' }))).toBe('plate')
    expect(groupOf(resolveCategory({ food_name: 'chicken tenders' }))).toBe('plate')
  })
})

describe('seed corpus (audit guard)', () => {
  it('resolves every real persona food to a non-generic category', () => {
    const generic = SEED_FOOD_NAMES.filter(
      (name) => resolveCategory({ food_name: name }) === FOOD_GENERIC,
    )
    expect(generic, `these fell back to ${FOOD_GENERIC}`).toEqual([])
  })
})
