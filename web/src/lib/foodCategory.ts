// Food category taxonomy + resolver — mirrors app/categories.py (kept in sync manually,
// like the snake_case API shapes). This is a *visual-first* taxonomy: a category exists to
// share an icon, and the icon depicts visual form (the vessel a food is served in, or its
// characteristic silhouette) — not its nutritional category. See the foodCategoryIcons map
// for key -> SVG, and FoodIcon for the rendered chip.

// --- Tier 1 groups (the AI enum; each has a dedicated icon) -----------------

export const GROUP_KEYS = [
  // Dish & distinctive-silhouette groups.
  'handheld',
  'bowl',
  'plate',
  'pizza',
  'pasta',
  'salad',
  'soup_stew',
  'taco_burrito',
  'pastry',
  // Drinks, by vessel.
  'hot_drink',
  'cold_drink',
  'alcohol',
  // Whole foods & the rest.
  'fruit',
  'vegetables',
  'protein',
  'grains_bread',
  'dairy',
  'snacks',
  'sweets',
  'extras',
] as const

export type GroupKey = (typeof GROUP_KEYS)[number]

// --- Tier 2 categories -> parent group --------------------------------------

export const TIER2_PARENTS: Record<string, GroupKey> = {
  // handheld
  burger: 'handheld',
  sandwich: 'handheld',
  sub_hoagie: 'handheld',
  wrap: 'handheld',
  panini: 'handheld',
  hot_dog: 'handheld',
  bagel_sandwich: 'handheld',
  topped_toast: 'handheld',
  // taco_burrito
  taco: 'taco_burrito',
  burrito: 'taco_burrito',
  quesadilla: 'taco_burrito',
  nachos: 'taco_burrito',
  enchilada: 'taco_burrito',
  // bowl
  rice_bowl: 'bowl',
  grain_bowl: 'bowl',
  poke: 'bowl',
  fried_rice: 'bowl',
  curry_rice: 'bowl',
  risotto: 'bowl',
  ramen: 'bowl',
  pho: 'bowl',
  oatmeal: 'bowl',
  acai_smoothie_bowl: 'bowl',
  parfait: 'bowl',
  cereal_bowl: 'bowl',
  sushi: 'bowl',
  dumplings: 'bowl',
  // plate
  roast_plate: 'plate',
  bbq_skewer: 'plate',
  fried_chicken: 'plate',
  fried_seafood: 'plate',
  casserole_bake: 'plate',
  stir_fry: 'plate',
  mixed_plate: 'plate',
  // pasta
  red_sauce: 'pasta',
  cream_sauce: 'pasta',
  mac_cheese: 'pasta',
  lasagna: 'pasta',
  stir_fry_noodles: 'pasta',
  // salad
  green_salad: 'salad',
  grain_salad: 'salad',
  protein_salad: 'salad',
  slaw: 'salad',
  // soup_stew
  soup_broth: 'soup_stew',
  stew: 'soup_stew',
  chili: 'soup_stew',
  curry: 'soup_stew',
  chowder: 'soup_stew',
  // pizza
  flatbread: 'pizza',
  calzone: 'pizza',
  // pastry
  croissant: 'pastry',
  muffin: 'pastry',
  danish: 'pastry',
  scone: 'pastry',
  cinnamon_roll: 'pastry',
  turnover: 'pastry',
  bagel_plain: 'pastry',
  // fruit
  apple_pear: 'fruit',
  banana: 'fruit',
  berries: 'fruit',
  citrus: 'fruit',
  grapes: 'fruit',
  melon: 'fruit',
  tropical_fruit: 'fruit',
  dried_fruit: 'fruit',
  // vegetables
  leafy_greens: 'vegetables',
  root_veg: 'vegetables',
  potato: 'vegetables',
  tomato: 'vegetables',
  cruciferous: 'vegetables',
  mushroom: 'vegetables',
  avocado: 'vegetables',
  corn: 'vegetables',
  // protein
  poultry: 'protein',
  red_meat: 'protein',
  pork: 'protein',
  fish: 'protein',
  shellfish: 'protein',
  eggs_omelet: 'protein',
  tofu: 'protein',
  beans_legumes: 'protein',
  // grains_bread
  bread: 'grains_bread',
  rice: 'grains_bread',
  cereal: 'grains_bread',
  oats: 'grains_bread',
  tortilla: 'grains_bread',
  bagel_toast: 'grains_bread',
  // dairy
  cheese: 'dairy',
  milk: 'dairy',
  yogurt: 'dairy',
  butter_cream: 'dairy',
  // snacks
  chips: 'snacks',
  crackers: 'snacks',
  nuts_seeds: 'snacks',
  popcorn: 'snacks',
  pretzels: 'snacks',
  granola_bar: 'snacks',
  jerky: 'snacks',
  // sweets
  chocolate: 'sweets',
  candy: 'sweets',
  cake: 'sweets',
  cookie: 'sweets',
  donut: 'sweets',
  ice_cream: 'sweets',
  pie_tart: 'sweets',
  pancakes_waffles: 'sweets',
  // hot_drink
  coffee: 'hot_drink',
  tea: 'hot_drink',
  latte_cappuccino: 'hot_drink',
  hot_cocoa: 'hot_drink',
  matcha: 'hot_drink',
  // cold_drink
  water: 'cold_drink',
  juice: 'cold_drink',
  soda: 'cold_drink',
  smoothie: 'cold_drink',
  milk_drink: 'cold_drink',
  protein_shake: 'cold_drink',
  energy_drink: 'cold_drink',
  sports_drink: 'cold_drink',
  iced_coffee: 'cold_drink',
  // alcohol
  beer: 'alcohol',
  wine: 'alcohol',
  cocktail: 'alcohol',
  spirits: 'alcohol',
  // extras
  sauce_condiment: 'extras',
  dressing: 'extras',
  oil: 'extras',
  spread: 'extras',
  sweetener_syrup: 'extras',
  supplement: 'extras',
  protein_powder: 'extras',
}

// Terminal fallbacks the resolver returns when nothing confident matches.
export const FOOD_GENERIC = 'food_generic'
export const BEVERAGE_GENERIC = 'beverage_generic'

export type CategoryKey = GroupKey | string

const GROUP_SET = new Set<string>(GROUP_KEYS)
const KNOWN_KEYS = new Set<string>([
  ...GROUP_KEYS,
  ...Object.keys(TIER2_PARENTS),
  FOOD_GENERIC,
  BEVERAGE_GENERIC,
])

export function isGroup(key: string): key is GroupKey {
  return GROUP_SET.has(key)
}

export function isKnownCategory(key: string | null | undefined): key is CategoryKey {
  return !!key && KNOWN_KEYS.has(key)
}

/** The Tier-1 group a key belongs to (a group maps to itself). */
export function groupOf(key: string): GroupKey | null {
  if (isGroup(key)) return key
  return TIER2_PARENTS[key] ?? null
}

// --- Keyword rules (food_name -> a Tier-2 or group key) ---------------------
// Ordered by precedence: composed-dish phrases and traps first, single ingredients last.
// The first rule with a whole-word phrase match wins. Tune via the audit script.

interface KeywordRule {
  cat: CategoryKey
  words: string[]
}

const KEYWORD_RULES: KeywordRule[] = [
  // --- Composed "* bowl" dishes: must beat handheld/ingredient keywords below
  //     (a "burrito bowl" is a bowl, not a burrito; a "smoothie bowl" is food, not a drink). ---
  { cat: 'rice_bowl', words: ['burrito bowl', 'rice bowl', 'grain bowl', 'quinoa bowl', 'bibimbap', 'donburi'] },
  { cat: 'poke', words: ['poke bowl'] },
  { cat: 'acai_smoothie_bowl', words: ['acai bowl', 'açaí bowl', 'smoothie bowl'] },

  // --- Composed dishes & traps (must beat their ingredient keywords) ---
  { cat: 'pizza', words: ['pizza', 'flatbread', 'calzone'] },
  { cat: 'taco', words: ['taco'] },
  { cat: 'burrito', words: ['burrito', 'chimichanga'] },
  { cat: 'quesadilla', words: ['quesadilla'] },
  { cat: 'nachos', words: ['nachos'] },
  { cat: 'enchilada', words: ['enchilada'] },
  { cat: 'burger', words: ['burger', 'cheeseburger', 'hamburger'] },
  { cat: 'hot_dog', words: ['hot dog', 'hotdog', 'corn dog'] },
  { cat: 'sub_hoagie', words: ['sub sandwich', 'hoagie', 'sub', 'gyro', 'banh mi'] },
  { cat: 'wrap', words: ['wrap', 'shawarma'] },
  { cat: 'panini', words: ['panini'] },
  { cat: 'bagel_sandwich', words: ['bagel sandwich', 'breakfast sandwich'] },
  { cat: 'topped_toast', words: ['avocado toast', 'toast with', 'topped toast'] },
  { cat: 'sandwich', words: ['sandwich', 'blt', 'club', 'grilled cheese', 'panino'] },
  { cat: 'protein_salad', words: ['caesar salad', 'cobb salad', 'chicken salad', 'tuna salad', 'egg salad'] },
  { cat: 'grain_salad', words: ['quinoa salad', 'pasta salad', 'grain salad', 'tabbouleh'] },
  { cat: 'slaw', words: ['coleslaw', 'slaw'] },
  { cat: 'green_salad', words: ['salad', 'greek salad', 'garden salad'] },
  { cat: 'mac_cheese', words: ['mac and cheese', 'mac n cheese', 'macaroni and cheese', 'mac & cheese'] },
  { cat: 'lasagna', words: ['lasagna', 'lasagne'] },
  { cat: 'red_sauce', words: ['spaghetti', 'bolognese', 'marinara', 'penne', 'rigatoni', 'pomodoro', 'arrabbiata'] },
  { cat: 'cream_sauce', words: ['carbonara', 'alfredo', 'fettuccine'] },
  { cat: 'pasta', words: ['pasta', 'ravioli', 'gnocchi', 'tortellini', 'orzo', 'linguine', 'ziti'] },
  { cat: 'ramen', words: ['ramen'] },
  { cat: 'pho', words: ['pho'] },
  { cat: 'stir_fry_noodles', words: ['pad thai', 'lo mein', 'chow mein', 'yakisoba', 'udon', 'soba'] },
  { cat: 'poke', words: ['poke bowl', 'poke'] },
  { cat: 'fried_rice', words: ['fried rice'] },
  { cat: 'curry_rice', words: ['curry rice', 'katsu curry', 'butter chicken', 'tikka masala', 'biryani'] },
  { cat: 'risotto', words: ['risotto'] },
  { cat: 'rice_bowl', words: ['rice bowl', 'bibimbap', 'donburi', 'burrito bowl'] },
  { cat: 'grain_bowl', words: ['buddha bowl', 'grain bowl', 'quinoa bowl'] },
  { cat: 'acai_smoothie_bowl', words: ['acai bowl', 'açaí bowl', 'smoothie bowl', 'acai'] },
  { cat: 'parfait', words: ['parfait'] },
  { cat: 'oatmeal', words: ['oatmeal', 'porridge', 'overnight oats'] },
  { cat: 'cereal_bowl', words: ['cereal', 'granola bowl', 'muesli'] },
  { cat: 'chili', words: ['chili', 'chilli'] },
  { cat: 'chowder', words: ['chowder', 'bisque'] },
  { cat: 'curry', words: ['curry'] },
  { cat: 'stew', words: ['stew', 'goulash', 'pot roast'] },
  { cat: 'soup_broth', words: ['soup', 'broth', 'minestrone'] },
  { cat: 'sushi', words: ['sushi', 'sashimi', 'maki', 'nigiri', 'temaki'] },
  { cat: 'dumplings', words: ['dumpling', 'gyoza', 'potsticker', 'wonton'] },
  { cat: 'fried_chicken', words: ['fried chicken', 'chicken tender', 'chicken tenders', 'chicken strip', 'chicken nugget', 'nuggets', 'chicken wing', 'wings', 'katsu'] },
  { cat: 'fried_seafood', words: ['fish and chips', 'fried shrimp', 'calamari'] },
  { cat: 'bbq_skewer', words: ['kebab', 'skewer', 'satay', 'yakitori', 'bbq'] },
  { cat: 'casserole_bake', words: ['casserole', 'gratin', 'pot pie', 'shepherd', 'parmesan', 'parmigiana'] },
  { cat: 'stir_fry', words: ['stir fry', 'stir-fry', 'stir fried'] },
  { cat: 'mixed_plate', words: ['thanksgiving', 'plate of', 'combo plate', 'platter', 'fajita'] },
  { cat: 'roast_plate', words: ['roast', 'steak dinner'] },
  { cat: 'eggs_omelet', words: ['omelet', 'omelette', 'scrambled egg', 'fried egg', 'frittata', 'eggs benedict', 'shakshuka'] },
  { cat: 'pancakes_waffles', words: ['pancake', 'waffle', 'french toast', 'crepe'] },

  // --- Pastry / bakery ---
  { cat: 'croissant', words: ['croissant'] },
  { cat: 'muffin', words: ['muffin'] },
  { cat: 'danish', words: ['danish', 'strudel'] },
  { cat: 'scone', words: ['scone', 'biscuit'] },
  { cat: 'cinnamon_roll', words: ['cinnamon roll', 'sticky bun'] },
  { cat: 'turnover', words: ['turnover', 'empanada'] },
  { cat: 'bagel_plain', words: ['bagel'] },

  // --- Drinks (vessel) ---
  { cat: 'protein_shake', words: ['protein shake', 'protein smoothie'] },
  { cat: 'milk_drink', words: ['milkshake', 'milk shake', 'shake'] },
  { cat: 'smoothie', words: ['smoothie'] },
  { cat: 'iced_coffee', words: ['iced coffee', 'cold brew', 'iced latte', 'frappuccino', 'frappe'] },
  { cat: 'latte_cappuccino', words: ['latte', 'cappuccino', 'macchiato', 'flat white', 'mocha'] },
  { cat: 'matcha', words: ['matcha'] },
  { cat: 'hot_cocoa', words: ['hot chocolate', 'hot cocoa'] },
  { cat: 'coffee', words: ['coffee', 'espresso', 'americano'] },
  { cat: 'tea', words: ['tea', 'chai', 'kombucha'] },
  { cat: 'energy_drink', words: ['energy drink', 'red bull', 'monster'] },
  { cat: 'sports_drink', words: ['gatorade', 'powerade', 'sports drink', 'electrolyte'] },
  { cat: 'soda', words: ['soda', 'cola', 'coke', 'pepsi', 'sprite', 'soft drink', 'lemonade'] },
  { cat: 'juice', words: ['juice'] },
  { cat: 'water', words: ['water', 'sparkling water', 'seltzer'] },
  { cat: 'beer', words: ['beer', 'lager', 'ipa', 'ale', 'pilsner'] },
  { cat: 'wine', words: ['wine', 'prosecco', 'champagne', 'rosé', 'rose wine'] },
  { cat: 'cocktail', words: ['cocktail', 'margarita', 'mojito', 'martini', 'negroni'] },
  { cat: 'spirits', words: ['whiskey', 'whisky', 'vodka', 'tequila', 'rum', 'gin', 'bourbon'] },

  // --- Sweets / snacks ---
  { cat: 'ice_cream', words: ['ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'froyo', 'sundae'] },
  { cat: 'donut', words: ['donut', 'doughnut'] },
  { cat: 'cake', words: ['cake', 'cupcake', 'brownie', 'cheesecake'] },
  { cat: 'cookie', words: ['cookie', 'macaron'] },
  { cat: 'pie_tart', words: ['pie', 'tart', 'cobbler'] },
  { cat: 'chocolate', words: ['chocolate'] },
  { cat: 'candy', words: ['candy', 'gummy', 'lollipop', 'caramel'] },
  { cat: 'popcorn', words: ['popcorn'] },
  { cat: 'pretzels', words: ['pretzel'] },
  { cat: 'chips', words: ['chips', 'crisps', 'tortilla chips', 'fries', 'french fries'] },
  { cat: 'crackers', words: ['cracker'] },
  { cat: 'granola_bar', words: ['granola bar', 'protein bar', 'cereal bar', 'clif bar'] },
  { cat: 'jerky', words: ['jerky'] },
  { cat: 'nuts_seeds', words: ['almond', 'peanut', 'cashew', 'walnut', 'pistachio', 'trail mix', 'seeds', 'nuts'] },

  // --- Dairy ---
  { cat: 'yogurt', words: ['yogurt', 'yoghurt', 'skyr'] },
  { cat: 'cheese', words: ['cheese', 'cheddar', 'mozzarella', 'feta', 'brie', 'parmesan cheese'] },
  { cat: 'butter_cream', words: ['butter', 'cream cheese', 'whipped cream'] },
  { cat: 'milk', words: ['milk'] },

  // --- Whole proteins ---
  { cat: 'shellfish', words: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'oyster', 'clam'] },
  { cat: 'fish', words: ['salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'fish', 'trout', 'mackerel'] },
  { cat: 'poultry', words: ['chicken', 'turkey', 'duck'] },
  { cat: 'pork', words: ['pork', 'bacon', 'ham', 'sausage', 'prosciutto'] },
  { cat: 'red_meat', words: ['beef', 'steak', 'lamb', 'venison', 'meatball', 'meatloaf'] },
  { cat: 'eggs_omelet', words: ['egg', 'eggs'] },
  { cat: 'tofu', words: ['tofu', 'tempeh', 'seitan'] },
  { cat: 'beans_legumes', words: ['beans', 'lentil', 'chickpea', 'hummus', 'edamame'] },

  // --- Fruit ---
  { cat: 'banana', words: ['banana', 'plantain'] },
  { cat: 'apple_pear', words: ['apple', 'pear'] },
  { cat: 'berries', words: ['berry', 'berries', 'strawberry', 'blueberry', 'raspberry'] },
  { cat: 'citrus', words: ['orange', 'lemon', 'lime', 'grapefruit', 'clementine', 'mandarin'] },
  { cat: 'grapes', words: ['grape', 'grapes'] },
  { cat: 'melon', words: ['melon', 'watermelon', 'cantaloupe'] },
  { cat: 'tropical_fruit', words: ['mango', 'pineapple', 'papaya', 'kiwi', 'passion fruit'] },
  { cat: 'dried_fruit', words: ['raisin', 'dried fruit', 'date', 'prune', 'dried apricot'] },

  // --- Vegetables (eggplant must beat the 'egg' protein rule above by sitting earlier? handled by word boundary) ---
  { cat: 'avocado', words: ['avocado', 'guacamole'] },
  { cat: 'potato', words: ['potato', 'mashed potato', 'sweet potato', 'hash brown'] },
  { cat: 'tomato', words: ['tomato'] },
  { cat: 'mushroom', words: ['mushroom'] },
  { cat: 'corn', words: ['corn'] },
  { cat: 'cruciferous', words: ['broccoli', 'cauliflower', 'brussels', 'cabbage', 'kale'] },
  { cat: 'root_veg', words: ['carrot', 'beet', 'radish', 'turnip', 'parsnip'] },
  { cat: 'leafy_greens', words: ['spinach', 'lettuce', 'arugula', 'greens', 'eggplant', 'zucchini', 'pepper', 'cucumber', 'asparagus', 'green bean', 'vegetable', 'veggie'] },

  // --- Grains / bread ---
  { cat: 'rice', words: ['rice'] },
  { cat: 'oats', words: ['oats', 'oat'] },
  { cat: 'tortilla', words: ['tortilla'] },
  { cat: 'bread', words: ['bread', 'toast', 'roll', 'baguette', 'naan', 'pita'] },

  // --- Extras ---
  { cat: 'protein_powder', words: ['protein powder', 'whey'] },
  { cat: 'supplement', words: ['vitamin', 'supplement', 'creatine', 'fish oil', 'multivitamin'] },
  { cat: 'sweetener_syrup', words: ['honey', 'maple syrup', 'syrup', 'sugar', 'jam', 'jelly'] },
  { cat: 'dressing', words: ['dressing', 'vinaigrette', 'ranch'] },
  { cat: 'oil', words: ['olive oil', 'oil'] },
  { cat: 'sauce_condiment', words: ['ketchup', 'mustard', 'mayo', 'sauce', 'salsa', 'gravy'] },
]

// Pre-compile each phrase to a whole-word regex so "egg" never matches inside "eggplant".
const COMPILED: { cat: CategoryKey; res: RegExp[] }[] = KEYWORD_RULES.map((rule) => ({
  cat: rule.cat,
  res: rule.words.map((w) => new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(w)}(?:[^a-z0-9]|$)`, 'i')),
}))

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** First keyword rule whose phrase appears as a whole word in the name, or null. */
export function keywordCategory(name: string): CategoryKey | null {
  const n = name.toLowerCase()
  for (const { cat, res } of COMPILED) {
    if (res.some((re) => re.test(n))) return cat
  }
  return null
}

// --- The resolver -----------------------------------------------------------

export interface ResolvableEntry {
  food_name: string
  category?: string | null
  is_beverage?: boolean | null
}

/**
 * Resolve a logged entry to a category key for its icon.
 *
 * Cascade (the "too coarse / misrepresents" defense): a barcode-derived Tier-2 wins
 * outright; otherwise the trusted AI *group* polices the keyword *Tier-2* guess — they
 * agree -> use the specific key; they conflict -> trust the AI group; the keyword alone
 * stands when there's no AI group. Nothing confident -> a neutral generic that reads as
 * intentional rather than a wrong-but-specific icon.
 */
export function resolveCategory(entry: ResolvableEntry): CategoryKey {
  const stored = isKnownCategory(entry.category) ? entry.category : null
  if (stored && !isGroup(stored)) return stored // barcode/OFF Tier-2 — highest trust

  const aiGroup = stored && isGroup(stored) ? stored : null
  const kw = keywordCategory(entry.food_name)
  if (kw) {
    if (!aiGroup || groupOf(kw) === aiGroup) return kw
    return aiGroup // conflict -> trust the AI's semantic group
  }
  if (aiGroup) return aiGroup
  return entry.is_beverage ? BEVERAGE_GENERIC : FOOD_GENERIC
}
