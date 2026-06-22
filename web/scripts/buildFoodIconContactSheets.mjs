#!/usr/bin/env node
/**
 * Generate static food-icon contact sheets for visual review.
 *
 * This is intentionally isolated from runtime app rendering. It reads the
 * current Tier-1 taxonomy, embeds a custom monoline pass, pulls selected
 * Phosphor/Fluent SVGs, and writes a standalone HTML review artifact.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const taxonomyPath = path.join(webRoot, 'src/lib/foodCategory.ts')
const mealsPath = path.join(webRoot, 'src/lib/meals.ts')
const outDir = path.join(webRoot, 'src/assets/food-icons/contact-sheets')

const FALLBACK_KEYS = ['food_generic', 'beverage_generic']
const SCALE_KEYS = [
  'bowl',
  'plate',
  'pasta',
  'salad',
  'soup_stew',
  'taco_burrito',
  'hot_drink',
  'cold_drink',
  'fruit',
  'protein',
  'dairy',
  'extras',
]

const SUBJECTS = {
  handheld: 'sandwich / handheld stack',
  bowl: 'bowl with contents',
  plate: 'plate with food',
  pizza: 'pizza slice',
  pasta: 'pasta bowl',
  salad: 'leafy salad bowl',
  soup_stew: 'soup or stew',
  taco_burrito: 'folded taco shell',
  pastry: 'croissant / pastry',
  hot_drink: 'steaming mug',
  cold_drink: 'cold cup with straw',
  alcohol: 'wine glass',
  fruit: 'apple',
  vegetables: 'carrot',
  protein: 'drumstick / protein',
  grains_bread: 'bread loaf',
  dairy: 'cheese wedge',
  snacks: 'popcorn / snack',
  sweets: 'cake slice',
  extras: 'condiment jar',
  food_generic: 'fork and knife',
  beverage_generic: 'plain tumbler',
}

const MEAL_SUBJECTS = {
  breakfast: 'sunrise breakfast cue',
  lunch: 'midday plate cue',
  dinner: 'evening dinner cue',
  snacks: 'snack bucket cue',
}

const PHOSPHOR_LICENSE = {
  label: 'Phosphor Icons regular SVGs',
  license: 'MIT',
  licenseUrl: 'https://raw.githubusercontent.com/phosphor-icons/core/main/LICENSE',
}

const FLUENT_LICENSE = {
  label: 'Microsoft Fluent Emoji Flat SVGs',
  license: 'MIT',
  licenseUrl: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE',
}

const PHOSPHOR_BASE = 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular'
const FLUENT_BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'

const PHOSPHOR = {
  handheld: { icon: 'hamburger', badge: 'approx', note: 'burger stands in for handheld foods' },
  burger: { icon: 'hamburger', badge: 'exact', note: 'hamburger' },
  bowl: { icon: 'bowl-food', badge: 'exact', note: 'bowl with food' },
  rice_bowl: { icon: 'bowl-food', badge: 'fallback', note: 'bowl-food stands in for rice bowl' },
  grain_bowl: { icon: 'bowl-food', badge: 'fallback', note: 'bowl-food stands in for grain bowl' },
  oatmeal: { icon: 'bowl-food', badge: 'fallback', note: 'bowl-food stands in for oatmeal' },
  cereal_bowl: { icon: 'bowl-food', badge: 'fallback', note: 'bowl-food stands in for cereal bowl' },
  plate: { icon: 'fork-knife', badge: 'approx', note: 'cutlery; missing plate-with-food' },
  pizza: { icon: 'pizza', badge: 'exact', note: 'pizza slice' },
  flatbread: { icon: 'pizza', badge: 'approx', note: 'pizza stands in for flatbread' },
  pasta: { badge: 'gap', note: 'no regular spaghetti/pasta match' },
  salad: { badge: 'gap', note: 'no regular salad match' },
  soup_stew: { icon: 'bowl-steam', badge: 'exact', note: 'steaming bowl' },
  soup_broth: { icon: 'bowl-steam', badge: 'exact', note: 'steaming bowl' },
  ramen: { icon: 'bowl-steam', badge: 'approx', note: 'steaming bowl stands in for ramen' },
  pho: { icon: 'bowl-steam', badge: 'approx', note: 'steaming bowl stands in for pho' },
  taco_burrito: { badge: 'gap', note: 'no regular taco/burrito match' },
  pastry: { icon: 'bread', badge: 'approx', note: 'bread stands in for pastry' },
  hot_drink: { icon: 'coffee', badge: 'exact', note: 'hot drink mug' },
  coffee: { icon: 'coffee', badge: 'exact', note: 'coffee mug' },
  latte_cappuccino: { icon: 'coffee', badge: 'approx', note: 'coffee mug stands in for latte' },
  iced_coffee: { icon: 'coffee', badge: 'approx', note: 'coffee mug stands in for iced coffee' },
  cold_drink: { badge: 'gap', note: 'no plain cold cup match' },
  alcohol: { icon: 'wine', badge: 'exact', note: 'wine glass' },
  wine: { icon: 'wine', badge: 'exact', note: 'wine glass' },
  cocktail: { icon: 'martini', badge: 'exact', note: 'martini glass' },
  spirits: { icon: 'martini', badge: 'approx', note: 'martini glass stands in for spirits' },
  fruit: { badge: 'gap', note: 'no non-logo apple match' },
  citrus: { icon: 'orange', badge: 'exact', note: 'orange/citrus' },
  vegetables: { icon: 'carrot', badge: 'exact', note: 'carrot' },
  root_veg: { icon: 'carrot', badge: 'exact', note: 'root vegetable' },
  avocado: { icon: 'avocado', badge: 'exact', note: 'avocado' },
  protein: { badge: 'gap', note: 'no drumstick/cut-of-meat group match' },
  fish: { icon: 'fish', badge: 'exact', note: 'fish' },
  shellfish: { icon: 'shrimp', badge: 'exact', note: 'shrimp/shellfish' },
  fried_seafood: { icon: 'shrimp', badge: 'approx', note: 'shrimp stands in for fried seafood' },
  eggs_omelet: { icon: 'egg', badge: 'exact', note: 'egg' },
  grains_bread: { icon: 'bread', badge: 'exact', note: 'bread loaf' },
  bread: { icon: 'bread', badge: 'exact', note: 'bread loaf' },
  dairy: { icon: 'cheese', badge: 'exact', note: 'cheese wedge' },
  cheese: { icon: 'cheese', badge: 'exact', note: 'cheese wedge' },
  snacks: { icon: 'popcorn', badge: 'exact', note: 'popcorn' },
  nuts_seeds: { icon: 'popcorn', badge: 'approx', note: 'popcorn stands in for snack texture' },
  popcorn: { icon: 'popcorn', badge: 'exact', note: 'popcorn' },
  sweets: { icon: 'cake', badge: 'exact', note: 'cake' },
  cake: { icon: 'cake', badge: 'exact', note: 'cake' },
  cookie: { icon: 'cookie', badge: 'exact', note: 'cookie' },
  ice_cream: { icon: 'ice-cream', badge: 'exact', note: 'ice cream' },
  extras: { icon: 'jar', badge: 'exact', note: 'jar' },
  sauce_condiment: { icon: 'jar', badge: 'exact', note: 'jar' },
  spread: { icon: 'jar', badge: 'exact', note: 'jar' },
  protein_powder: { icon: 'jar', badge: 'approx', note: 'jar stands in for powder container' },
  food_generic: { icon: 'fork-knife', badge: 'exact', note: 'fork and knife' },
  beverage_generic: { badge: 'gap', note: 'no plain tumbler match' },
}

const PHOSPHOR_MEALS = {
  breakfast: { icon: 'sun-horizon', badge: 'approx', note: 'sunrise cue; not meal-specific' },
  lunch: { icon: 'sun', badge: 'approx', note: 'midday cue; not meal-specific' },
  dinner: { icon: 'moon', badge: 'approx', note: 'evening cue; not meal-specific' },
  snacks: { icon: 'popcorn', badge: 'approx', note: 'popcorn stands in for snacks' },
}

const FLUENT = {
  handheld: { folder: 'Sandwich', file: 'sandwich_flat.svg' },
  burger: { folder: 'Hamburger', file: 'hamburger_flat.svg' },
  sandwich: { folder: 'Sandwich', file: 'sandwich_flat.svg' },
  hot_dog: { folder: 'Hot dog', file: 'hot_dog_flat.svg' },
  wrap: { folder: 'Stuffed flatbread', file: 'stuffed_flatbread_flat.svg' },
  bowl: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  ramen: { folder: 'Steaming bowl', file: 'steaming_bowl_flat.svg' },
  pho: { folder: 'Steaming bowl', file: 'steaming_bowl_flat.svg' },
  oatmeal: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  cereal_bowl: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  curry_rice: { folder: 'Curry rice', file: 'curry_rice_flat.svg' },
  sushi: { folder: 'Sushi', file: 'sushi_flat.svg' },
  dumplings: { folder: 'Dumpling', file: 'dumpling_flat.svg' },
  plate: { folder: 'Fork and knife with plate', file: 'fork_and_knife_with_plate_flat.svg' },
  fried_chicken: { folder: 'Poultry leg', file: 'poultry_leg_flat.svg' },
  fried_seafood: { folder: 'Fried shrimp', file: 'fried_shrimp_flat.svg' },
  casserole_bake: { folder: 'Shallow pan of food', file: 'shallow_pan_of_food_flat.svg' },
  stir_fry: { folder: 'Shallow pan of food', file: 'shallow_pan_of_food_flat.svg' },
  pizza: { folder: 'Pizza', file: 'pizza_flat.svg' },
  flatbread: { folder: 'Flatbread', file: 'flatbread_flat.svg' },
  pasta: { folder: 'Spaghetti', file: 'spaghetti_flat.svg' },
  salad: { folder: 'Green salad', file: 'green_salad_flat.svg' },
  green_salad: { folder: 'Green salad', file: 'green_salad_flat.svg' },
  soup_stew: { folder: 'Pot of food', file: 'pot_of_food_flat.svg' },
  soup_broth: { folder: 'Pot of food', file: 'pot_of_food_flat.svg' },
  taco_burrito: { folder: 'Taco', file: 'taco_flat.svg' },
  taco: { folder: 'Taco', file: 'taco_flat.svg' },
  burrito: { folder: 'Burrito', file: 'burrito_flat.svg' },
  pastry: { folder: 'Croissant', file: 'croissant_flat.svg' },
  croissant: { folder: 'Croissant', file: 'croissant_flat.svg' },
  muffin: { folder: 'Cupcake', file: 'cupcake_flat.svg' },
  bagel_plain: { folder: 'Bagel', file: 'bagel_flat.svg' },
  hot_drink: { folder: 'Hot beverage', file: 'hot_beverage_flat.svg' },
  coffee: { folder: 'Hot beverage', file: 'hot_beverage_flat.svg' },
  latte_cappuccino: { folder: 'Hot beverage', file: 'hot_beverage_flat.svg' },
  hot_cocoa: { folder: 'Hot beverage', file: 'hot_beverage_flat.svg' },
  tea: { folder: 'Teacup without handle', file: 'teacup_without_handle_flat.svg' },
  matcha: { folder: 'Teacup without handle', file: 'teacup_without_handle_flat.svg' },
  cold_drink: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  water: { folder: 'Potable water', file: 'potable_water_flat.svg' },
  juice: { folder: 'Beverage box', file: 'beverage_box_flat.svg' },
  soda: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  smoothie: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  milk_drink: { folder: 'Glass of milk', file: 'glass_of_milk_flat.svg' },
  protein_shake: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  energy_drink: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  sports_drink: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  iced_coffee: { folder: 'Cup with straw', file: 'cup_with_straw_flat.svg' },
  alcohol: { folder: 'Wine glass', file: 'wine_glass_flat.svg' },
  beer: { folder: 'Beer mug', file: 'beer_mug_flat.svg' },
  wine: { folder: 'Wine glass', file: 'wine_glass_flat.svg' },
  cocktail: { folder: 'Cocktail glass', file: 'cocktail_glass_flat.svg' },
  spirits: { folder: 'Tumbler glass', file: 'tumbler_glass_flat.svg' },
  fruit: { folder: 'Red apple', file: 'red_apple_flat.svg' },
  apple_pear: { folder: 'Red apple', file: 'red_apple_flat.svg' },
  banana: { folder: 'Banana', file: 'banana_flat.svg' },
  berries: { folder: 'Blueberries', file: 'blueberries_flat.svg' },
  citrus: { folder: 'Tangerine', file: 'tangerine_flat.svg' },
  grapes: { folder: 'Grapes', file: 'grapes_flat.svg' },
  melon: { folder: 'Melon', file: 'melon_flat.svg' },
  tropical_fruit: { folder: 'Mango', file: 'mango_flat.svg' },
  vegetables: { folder: 'Carrot', file: 'carrot_flat.svg' },
  leafy_greens: { folder: 'Leafy green', file: 'leafy_green_flat.svg' },
  root_veg: { folder: 'Carrot', file: 'carrot_flat.svg' },
  potato: { folder: 'Potato', file: 'potato_flat.svg' },
  tomato: { folder: 'Tomato', file: 'tomato_flat.svg' },
  cruciferous: { folder: 'Broccoli', file: 'broccoli_flat.svg' },
  mushroom: { folder: 'Mushroom', file: 'mushroom_flat.svg' },
  avocado: { folder: 'Avocado', file: 'avocado_flat.svg' },
  corn: { folder: 'Ear of corn', file: 'ear_of_corn_flat.svg' },
  protein: { folder: 'Poultry leg', file: 'poultry_leg_flat.svg' },
  poultry: { folder: 'Poultry leg', file: 'poultry_leg_flat.svg' },
  red_meat: { folder: 'Cut of meat', file: 'cut_of_meat_flat.svg' },
  pork: { folder: 'Bacon', file: 'bacon_flat.svg' },
  fish: { folder: 'Fish', file: 'fish_flat.svg' },
  shellfish: { folder: 'Shrimp', file: 'shrimp_flat.svg' },
  eggs_omelet: { folder: 'Egg', file: 'egg_flat.svg' },
  tofu: { folder: 'Beans', file: 'beans_flat.svg' },
  beans_legumes: { folder: 'Beans', file: 'beans_flat.svg' },
  grains_bread: { folder: 'Bread', file: 'bread_flat.svg' },
  bread: { folder: 'Bread', file: 'bread_flat.svg' },
  rice: { folder: 'Cooked rice', file: 'cooked_rice_flat.svg' },
  cereal: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  oats: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  tortilla: { folder: 'Flatbread', file: 'flatbread_flat.svg' },
  bagel_toast: { folder: 'Bagel', file: 'bagel_flat.svg' },
  dairy: { folder: 'Cheese wedge', file: 'cheese_wedge_flat.svg' },
  cheese: { folder: 'Cheese wedge', file: 'cheese_wedge_flat.svg' },
  milk: { folder: 'Glass of milk', file: 'glass_of_milk_flat.svg' },
  yogurt: { folder: 'Bowl with spoon', file: 'bowl_with_spoon_flat.svg' },
  butter_cream: { folder: 'Butter', file: 'butter_flat.svg' },
  snacks: { folder: 'Popcorn', file: 'popcorn_flat.svg' },
  chips: { folder: 'French fries', file: 'french_fries_flat.svg' },
  crackers: { folder: 'Rice cracker', file: 'rice_cracker_flat.svg' },
  nuts_seeds: { folder: 'Peanuts', file: 'peanuts_flat.svg' },
  popcorn: { folder: 'Popcorn', file: 'popcorn_flat.svg' },
  pretzels: { folder: 'Pretzel', file: 'pretzel_flat.svg' },
  granola_bar: { folder: 'Chocolate bar', file: 'chocolate_bar_flat.svg' },
  jerky: { folder: 'Cut of meat', file: 'cut_of_meat_flat.svg' },
  sweets: { folder: 'Shortcake', file: 'shortcake_flat.svg' },
  chocolate: { folder: 'Chocolate bar', file: 'chocolate_bar_flat.svg' },
  candy: { folder: 'Candy', file: 'candy_flat.svg' },
  cake: { folder: 'Shortcake', file: 'shortcake_flat.svg' },
  cookie: { folder: 'Cookie', file: 'cookie_flat.svg' },
  donut: { folder: 'Doughnut', file: 'doughnut_flat.svg' },
  ice_cream: { folder: 'Soft ice cream', file: 'soft_ice_cream_flat.svg' },
  pie_tart: { folder: 'Pie', file: 'pie_flat.svg' },
  pancakes_waffles: { folder: 'Pancakes', file: 'pancakes_flat.svg' },
  extras: { folder: 'Jar', file: 'jar_flat.svg' },
  sauce_condiment: { folder: 'Jar', file: 'jar_flat.svg' },
  dressing: { folder: 'Jar', file: 'jar_flat.svg' },
  oil: { folder: 'Pouring liquid', file: 'pouring_liquid_flat.svg' },
  spread: { folder: 'Jar', file: 'jar_flat.svg' },
  sweetener_syrup: { folder: 'Honey pot', file: 'honey_pot_flat.svg' },
  supplement: { folder: 'Pill', file: 'pill_flat.svg' },
  protein_powder: { folder: 'Jar', file: 'jar_flat.svg' },
  food_generic: { folder: 'Fork and knife', file: 'fork_and_knife_flat.svg' },
  beverage_generic: { folder: 'Tumbler glass', file: 'tumbler_glass_flat.svg' },
}

const FLUENT_MEALS = {
  breakfast: {
    folder: 'Sunrise',
    file: 'sunrise_flat.svg',
    badge: 'approx',
    note: 'sunrise cue; not meal-specific',
  },
  lunch: {
    folder: 'Sun',
    file: 'sun_flat.svg',
    badge: 'approx',
    note: 'midday cue; not meal-specific',
  },
  dinner: {
    folder: 'Crescent moon',
    file: 'crescent_moon_flat.svg',
    badge: 'approx',
    note: 'evening cue; not meal-specific',
  },
  snacks: {
    folder: 'Popcorn',
    file: 'popcorn_flat.svg',
    badge: 'approx',
    note: 'popcorn stands in for snacks',
  },
}

function sourceUrlForFluent(asset) {
  return `${FLUENT_BASE}/${encodeURIComponent(asset.folder)}/Flat/${asset.file}`
}

function sourceUrlForPhosphor(icon) {
  return `${PHOSPHOR_BASE}/${icon}.svg`
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function attrs(extra = '') {
  return `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" ${extra}`
}

function svg(inner, extra = '') {
  return `<svg ${attrs(extra)}>${inner}</svg>`
}

const CUSTOM_ICONS = {
  handheld: svg(`
    <path d="M5 11h14" />
    <path d="M6.5 8.5c1.1-2 3-3 5.5-3s4.4 1 5.5 3" />
    <path d="M6 13.5h12" />
    <path d="M7 16.5h10" />
    <path d="M6 11c.4 1.8 1.8 2.5 6 2.5s5.6-.7 6-2.5" />
  `),
  bowl: svg(`
    <path d="M5 12.5h14" />
    <path d="M6.5 12.5c.5 4 2.4 6 5.5 6s5-2 5.5-6" />
    <path d="M8.5 9.5c1-.7 2-.7 3 0s2 .7 3 0" />
    <path d="M9 6.8c.9-.6 1.8-.6 2.7 0" />
  `),
  plate: svg(`
    <ellipse cx="12" cy="14" rx="7.5" ry="3.6" />
    <path d="M9 12.6c.5-1.5 1.4-2.3 2.6-2.3 1.8 0 2.9 1.6 3.4 3.7" />
    <path d="M14.4 10.9l1.7-1.7" />
    <path d="M7.5 14.2h9" />
  `),
  pizza: svg(`
    <path d="M5 19 19 5" />
    <path d="M5 19c3.6-1.3 7.3-1.1 11 0" />
    <path d="M19 5c.9 3.6-.2 7.4-3 14" />
    <circle cx="13" cy="12" r=".75" fill="currentColor" stroke="none" />
    <circle cx="10" cy="16" r=".75" fill="currentColor" stroke="none" />
  `),
  pasta: svg(`
    <path d="M5 13h14" />
    <path d="M6.5 13c.5 3.6 2.4 5.4 5.5 5.4s5-1.8 5.5-5.4" />
    <path d="M10 11c1.4-1 2.6-1 4 0" />
    <path d="M13.5 11V5" />
    <path d="M15.5 5v5.8" />
    <path d="M13.5 7h3" />
  `),
  salad: svg(`
    <path d="M5 13h14" />
    <path d="M6.5 13c.5 3.6 2.4 5.4 5.5 5.4s5-1.8 5.5-5.4" />
    <path d="M8 11c.7-2.6 2.2-3.6 4-2.6" />
    <path d="M12 11c.4-3 1.8-4.3 4.2-3.8" />
    <path d="M10 10.5c1.2-1 2.4-1 3.6 0" />
  `),
  soup_stew: svg(`
    <path d="M5 13h14" />
    <path d="M6.5 13c.5 3.7 2.4 5.5 5.5 5.5s5-1.8 5.5-5.5" />
    <path d="M9 8.8c-1-1.1-1-2.2 0-3.3" />
    <path d="M12 8.8c-1-1.1-1-2.2 0-3.3" />
    <path d="M15 8.8c-1-1.1-1-2.2 0-3.3" />
  `),
  taco_burrito: svg(`
    <path d="M5 16c.5-4.7 3.2-8 7-8s6.5 3.3 7 8" />
    <path d="M5 16h14" />
    <path d="M8 13.3c.5-.7 1.1-.7 1.7 0 .6.7 1.2.7 1.8 0 .6-.7 1.2-.7 1.8 0 .6.7 1.2.7 1.8 0 .4-.5.9-.6 1.4-.3" />
  `),
  pastry: svg(`
    <path d="M4.5 14c1.2-4.7 4-7.4 7.5-7.4s6.3 2.7 7.5 7.4" />
    <path d="M4.5 14c2.5 3 5 4.4 7.5 4.4s5-1.4 7.5-4.4" />
    <path d="M8.4 9.2c1.1 2.2 1.2 5.2.4 7" />
    <path d="M15.6 9.2c-1.1 2.2-1.2 5.2-.4 7" />
  `),
  hot_drink: svg(`
    <path d="M7 10h8v5.2a3.3 3.3 0 0 1-3.3 3.3H10.3A3.3 3.3 0 0 1 7 15.2V10Z" />
    <path d="M15 11h1.2a2.1 2.1 0 0 1 0 4.2H15" />
    <path d="M9 7c-.8-.8-.8-1.6 0-2.4" />
    <path d="M12 7c-.8-.8-.8-1.6 0-2.4" />
  `),
  cold_drink: svg(`
    <path d="M8 8h9l-1 11H9L8 8Z" />
    <path d="M7 8h11" />
    <path d="M13 8 11.5 5h-2" />
    <path d="M9 12h8" />
  `),
  alcohol: svg(`
    <path d="M8 5h8l-.6 5.3A3.4 3.4 0 0 1 12 13.5a3.4 3.4 0 0 1-3.4-3.2L8 5Z" />
    <path d="M12 13.5V19" />
    <path d="M9.5 19h5" />
    <path d="M8.6 9.5h6.8" />
  `),
  fruit: svg(`
    <path d="M12 8c3.3-1.8 6 1 5.5 5.2-.4 3.4-2.4 5.8-4.4 5.1-.7-.2-1.5-.2-2.2 0-2 .7-4-1.7-4.4-5.1C6 9 8.7 6.2 12 8Z" />
    <path d="M12 8c-.1-1.7.6-3 2-4" />
    <path d="M14 5c1.4-.4 2.5-.1 3.2.8" />
  `),
  vegetables: svg(`
    <path d="m8 11 5 8 4-2-5-8" />
    <path d="M10 9c2-2.6 4.5-3.2 7.5-1.8" />
    <path d="M10 9c-1.5-1.9-3.2-2.4-5-1.4" />
    <path d="m11 13 2.5-1.4" />
  `),
  protein: svg(`
    <path d="M14.4 6.3c2.6 1.4 3.6 4.4 2.3 6.7-1.3 2.4-4.5 3-7.1 1.6-2.6-1.4-3.6-4.4-2.3-6.7 1.3-2.4 4.5-3 7.1-1.6Z" />
    <path d="m8 14-2.5 2.5" />
    <path d="M4.3 17.7c-.8-.8-.8-2.1 0-2.9.8-.8 2.1-.8 2.9 0" />
  `),
  grains_bread: svg(`
    <path d="M5.5 12.5c0-4.3 2.4-7 6.5-7s6.5 2.7 6.5 7v5h-13v-5Z" />
    <path d="M8 17.5v-4" />
    <path d="M12 17.5v-5" />
    <path d="M16 17.5v-4" />
  `),
  dairy: svg(`
    <path d="M5 16.5 15.5 7 19 17.5H5Z" />
    <path d="M15.5 7v10.5" />
    <circle cx="12" cy="14" r=".8" />
    <circle cx="16.5" cy="15" r=".65" />
  `),
  snacks: svg(`
    <path d="M7 10h10l-1.2 9H8.2L7 10Z" />
    <path d="M8 10 7.2 6.5 10 8l2-2 2 2 2.8-1.5L16 10" />
    <path d="M10 13v4" />
    <path d="M14 13v4" />
  `),
  sweets: svg(`
    <path d="M5 18h14" />
    <path d="M6 18 9 8h7l2 10" />
    <path d="M8.2 12h8.4" />
    <path d="M10 8V5.5" />
    <path d="M10 5.5c1-.8 2-.8 3 0" />
  `),
  extras: svg(`
    <path d="M9 8h6" />
    <path d="M10 8V5.5h4V8" />
    <path d="M8 11.2c0-1.8 1.2-3.2 3-3.2h2c1.8 0 3 1.4 3 3.2V19H8v-7.8Z" />
    <path d="M10 13h4" />
    <path d="M10 16h4" />
  `),
  food_generic: svg(`
    <path d="M7 4v16" />
    <path d="M5 4v5" />
    <path d="M9 4v5" />
    <path d="M5 9h4" />
    <path d="M16 4v16" />
    <path d="M16 4c2.2 1.4 3.2 3.8 3 7h-3" />
  `),
  beverage_generic: svg(`
    <path d="M8 7h8l-1 12H9L8 7Z" />
    <path d="M7 7h10" />
    <path d="M9 11h6" />
  `),
}

const MEAL_CUSTOM_ICONS = {
  breakfast: svg(`
    <path d="M4.5 16h15" />
    <path d="M7 16a5 5 0 0 1 10 0" />
    <path d="M12 6V4" />
    <path d="m8.4 8.4-1.3-1.3" />
    <path d="m15.6 8.4 1.3-1.3" />
    <path d="M8 19h8" />
  `),
  lunch: svg(`
    <circle cx="12" cy="6.8" r="2.4" />
    <path d="M12 2.8V1.8" />
    <path d="M12 11.8v-1" />
    <path d="M7.9 6.8h-1" />
    <path d="M17.1 6.8h-1" />
    <ellipse cx="12" cy="17" rx="6.4" ry="2.8" />
    <path d="M8.6 16.6h6.8" />
  `),
  dinner: svg(`
    <path d="M16.8 4.5a5.6 5.6 0 1 0 1.7 9.7 4.3 4.3 0 1 1-1.7-9.7Z" />
    <path d="M6 18h12" />
    <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
    <path d="M12 13.5v-1" />
  `),
  snacks: svg(`
    <path d="M7 10h10l-1.2 9H8.2L7 10Z" />
    <path d="M8 10 7.2 6.6 10 8l2-2 2 2 2.8-1.4L16 10" />
    <path d="M10 13v4" />
    <path d="M14 13v4" />
    <path d="M5.2 7.2 4 6" />
    <path d="m18.8 7.2 1.2-1.2" />
  `),
}

function parseGroupKeys(source) {
  const match = source.match(/export const GROUP_KEYS = \[([\s\S]*?)\] as const/)
  if (!match) throw new Error(`Could not parse GROUP_KEYS from ${path.relative(repoRoot, taxonomyPath)}`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function parseTier2Parents(source) {
  const match = source.match(/export const TIER2_PARENTS: Record<string, GroupKey> = \{([\s\S]*?)\n\}/)
  if (!match) throw new Error(`Could not parse TIER2_PARENTS from ${path.relative(repoRoot, taxonomyPath)}`)
  return [...match[1].matchAll(/([a-z0-9_]+): '([^']+)'/g)].map((m) => ({ key: m[1], parent: m[2] }))
}

function parseMealOrder(source) {
  const match = source.match(/export const MEAL_ORDER: Meal\[] = \[([\s\S]*?)\]/)
  if (!match) throw new Error(`Could not parse MEAL_ORDER from ${path.relative(repoRoot, mealsPath)}`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function parseMealLabels(source) {
  const match = source.match(/export const MEAL_LABELS: Record<Meal, string> = \{([\s\S]*?)\n\}/)
  if (!match) throw new Error(`Could not parse MEAL_LABELS from ${path.relative(repoRoot, mealsPath)}`)
  return Object.fromEntries([...match[1].matchAll(/([a-z0-9_]+): '([^']+)'/g)].map((m) => [m[1], m[2]]))
}

function titleizeKey(key) {
  return key.replaceAll('_', ' ')
}

function subjectFor(key) {
  return SUBJECTS[key] || titleizeKey(key)
}

function mealSubjectFor(key) {
  return MEAL_SUBJECTS[key] || titleizeKey(key)
}

function groupTier2ByParent(tier2) {
  const byParent = new Map()
  for (const item of tier2) {
    if (!byParent.has(item.parent)) byParent.set(item.parent, [])
    byParent.get(item.parent).push(item.key)
  }
  return byParent
}

function buildRecords(groupKeys, tier2) {
  const byParent = groupTier2ByParent(tier2)
  const records = []
  for (const group of groupKeys) {
    records.push({ key: group, tier: 'Tier 1', parent: null })
    for (const key of byParent.get(group) || []) {
      records.push({ key, tier: 'Tier 2', parent: group })
    }
  }
  for (const key of FALLBACK_KEYS) {
    records.push({ key, tier: 'Fallback', parent: null })
  }
  return records
}

function normalizeSvg(raw) {
  return raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/\s(width|height)="[^"]*"/g, '')
    .trim()
}

function prefixSvgIds(raw, prefix) {
  const ids = new Set()
  let svgText = raw.replace(/\sid="([^"]+)"/g, (_, id) => {
    ids.add(id)
    return ` id="${prefix}-${id}"`
  })
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    svgText = svgText
      .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${prefix}-${id})`)
      .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${prefix}-${id}"`)
      .replace(new RegExp(`xlink:href="#${escaped}"`, 'g'), `xlink:href="#${prefix}-${id}"`)
  }
  return svgText
}

async function fetchSvg(url, label, prefix) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${url}`)
  }
  return prefixSvgIds(normalizeSvg(await response.text()), prefix)
}

function customMeta(record) {
  if (CUSTOM_ICONS[record.key]) {
    return { icon: CUSTOM_ICONS[record.key], meta: { badge: 'custom', note: 'house monoline' } }
  }
  if (record.parent && CUSTOM_ICONS[record.parent]) {
    return {
      icon: CUSTOM_ICONS[record.parent],
      meta: { badge: 'fallback', note: `inherits ${record.parent}` },
    }
  }
  return { icon: '', meta: { badge: 'gap', note: 'no custom icon' } }
}

function mealCustomMeta(key) {
  if (MEAL_CUSTOM_ICONS[key]) {
    return { icon: MEAL_CUSTOM_ICONS[key], meta: { badge: 'custom', note: 'house monoline' } }
  }
  return { icon: '', meta: { badge: 'gap', note: 'no custom meal icon' } }
}

function phosphorMeta(record) {
  const own = PHOSPHOR[record.key]
  if (own?.icon || own?.badge === 'gap') return own
  if (record.parent && PHOSPHOR[record.parent]?.icon) {
    return {
      ...PHOSPHOR[record.parent],
      badge: 'fallback',
      note: `inherits ${record.parent}`,
    }
  }
  return { badge: 'gap', note: 'no sourced outline match' }
}

function mealPhosphorMeta(key) {
  return PHOSPHOR_MEALS[key] || { badge: 'gap', note: 'no sourced outline match' }
}

function fluentMeta(record) {
  const own = FLUENT[record.key]
  if (own) return { ...own, badge: 'exact', note: own.folder }
  if (record.parent && FLUENT[record.parent]) {
    return {
      ...FLUENT[record.parent],
      badge: 'fallback',
      note: `inherits ${record.parent}`,
    }
  }
  return { badge: 'gap', note: 'no Fluent match' }
}

function mealFluentMeta(key) {
  return FLUENT_MEALS[key] || { badge: 'gap', note: 'no Fluent match' }
}

async function loadRemoteAssets(records) {
  const assets = {}
  for (const record of records) {
    const ph = phosphorMeta(record)
    const fluent = fluentMeta(record)
    assets[record.key] = {}
    if (ph?.icon) {
      assets[record.key].phosphor = await fetchSvg(
        sourceUrlForPhosphor(ph.icon),
        `Phosphor ${record.key}`,
        `ph-${record.key}`,
      )
    }
    if (fluent?.folder) {
      assets[record.key].fluent = await fetchSvg(
        sourceUrlForFluent(fluent),
        `Fluent ${record.key}`,
        `fl-${record.key}`,
      )
    }
  }
  return assets
}

async function loadMealRemoteAssets(mealKeys) {
  const assets = {}
  for (const key of mealKeys) {
    const ph = mealPhosphorMeta(key)
    const fluent = mealFluentMeta(key)
    assets[key] = {}
    if (ph?.icon) {
      assets[key].phosphor = await fetchSvg(
        sourceUrlForPhosphor(ph.icon),
        `Phosphor meal ${key}`,
        `meal-ph-${key}`,
      )
    }
    if (fluent?.folder) {
      assets[key].fluent = await fetchSvg(
        sourceUrlForFluent(fluent),
        `Fluent meal ${key}`,
        `meal-fl-${key}`,
      )
    }
  }
  return assets
}

function badge(meta) {
  if (!meta) return ''
  return `<span class="badge badge--${htmlEscape(meta.badge)}">${htmlEscape(meta.badge)}</span>`
}

function renderIconCell({ family, icon, meta, sourceLabel }) {
  const empty = !icon
  return `
    <div class="icon-card ${empty ? 'icon-card--empty' : ''}">
      <div class="icon-frame icon-frame--${family}">${icon || '<span class="missing-mark">--</span>'}</div>
      <div class="icon-note">
        ${badge(meta)}
        <span>${htmlEscape(meta?.note || sourceLabel)}</span>
      </div>
    </div>
  `
}

function renderRows(records, assets) {
  const rows = []
  for (const record of records) {
    if (record.tier === 'Tier 1') {
      rows.push(`
        <tr class="group-divider">
          <th colspan="6">
            <code>${htmlEscape(record.key)}</code>
            <span>${htmlEscape(subjectFor(record.key))}</span>
          </th>
        </tr>
      `)
    }
    const custom = customMeta(record)
    const ph = phosphorMeta(record)
    const fluent = fluentMeta(record)
    rows.push(`
        <tr>
          <th scope="row">
            <code>${htmlEscape(record.key)}</code>
            <span>${htmlEscape(subjectFor(record.key))}</span>
          </th>
          <td><span class="tier-pill tier-pill--${record.tier.toLowerCase().replaceAll(' ', '-')}">${record.tier}</span></td>
          <td>${record.parent ? `<code>${htmlEscape(record.parent)}</code>` : '<span class="muted">--</span>'}</td>
          <td>${renderIconCell({ family: 'custom', icon: custom.icon, meta: custom.meta, sourceLabel: 'house monoline' })}</td>
          <td>${renderIconCell({ family: 'phosphor', icon: assets[record.key].phosphor, meta: ph, sourceLabel: 'Phosphor regular' })}</td>
          <td>${renderIconCell({ family: 'fluent', icon: assets[record.key].fluent, meta: fluent, sourceLabel: 'Fluent Emoji Flat' })}</td>
        </tr>
    `)
  }
  return rows.join('\n')
}

function renderMealRows(mealKeys, mealLabels, mealAssets) {
  return mealKeys.map((key) => {
    const custom = mealCustomMeta(key)
    const ph = mealPhosphorMeta(key)
    const fluent = mealFluentMeta(key)
    return `
        <tr>
          <th scope="row">
            <code>${htmlEscape(key)}</code>
            <span>${htmlEscape(mealLabels[key] || titleizeKey(key))}</span>
          </th>
          <td><span class="tier-pill tier-pill--meal">Meal bucket</span></td>
          <td>${htmlEscape(mealSubjectFor(key))}</td>
          <td>${renderIconCell({ family: 'custom', icon: custom.icon, meta: custom.meta, sourceLabel: 'house monoline' })}</td>
          <td>${renderIconCell({ family: 'phosphor', icon: mealAssets[key].phosphor, meta: ph, sourceLabel: 'Phosphor regular' })}</td>
          <td>${renderIconCell({ family: 'fluent', icon: mealAssets[key].fluent, meta: fluent, sourceLabel: 'Fluent Emoji Flat' })}</td>
        </tr>
    `
  }).join('\n')
}

function scaleIcon(icon, family) {
  return [18, 20, 32]
    .map((size) => `
      <div class="scale-item" style="--icon-size:${size}px">
        <span class="scale-icon scale-icon--${family}">${icon}</span>
        <small>${size}px</small>
      </div>
    `)
    .join('')
}

function renderScaleStrips(assets) {
  return SCALE_KEYS.map((key) => `
    <section class="scale-row">
      <h3><code>${htmlEscape(key)}</code><span>${htmlEscape(subjectFor(key))}</span></h3>
      <div class="scale-families">
        <div>
          <h4>Custom monoline</h4>
          <div class="scale-strip">${scaleIcon(CUSTOM_ICONS[key], 'custom')}</div>
        </div>
        <div>
          <h4>Sourced outline</h4>
          <div class="scale-strip">${assets[key].phosphor ? scaleIcon(assets[key].phosphor, 'phosphor') : '<p class="scale-gap">No exact sourced outline match.</p>'}</div>
        </div>
        <div>
          <h4>Fluent color</h4>
          <div class="scale-strip">${scaleIcon(assets[key].fluent, 'fluent')}</div>
        </div>
      </div>
    </section>
  `).join('\n')
}

function renderTaxonomyOverview(groupKeys, byParent) {
  return groupKeys.map((group) => {
    const children = byParent.get(group) || []
    return `
      <article class="taxonomy-card">
        <h3><code>${htmlEscape(group)}</code><span>${children.length} Tier-2</span></h3>
        <p>${htmlEscape(subjectFor(group))}</p>
        <div class="taxonomy-children">
          ${children.map((key) => `<code>${htmlEscape(key)}</code>`).join('')}
        </div>
      </article>
    `
  }).join('\n')
}

function renderMealTaxonomy(mealKeys, mealLabels) {
  return mealKeys.map((key) => `
    <article class="meal-taxonomy-card">
      <h3><code>${htmlEscape(key)}</code><span>${htmlEscape(mealLabels[key] || titleizeKey(key))}</span></h3>
      <p>${htmlEscape(mealSubjectFor(key))}</p>
    </article>
  `).join('\n')
}

function renderHtml({ groupKeys, tier2, byParent, records, assets, mealKeys, mealLabels, mealAssets }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Food Icon Contact Sheets</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f4ef;
      --paper: #fffdf8;
      --ink: #24221d;
      --muted: #746f64;
      --line: #ded8cc;
      --accent: #7b5f36;
      --accent-soft: #f0e4d2;
      --good: #256f48;
      --warn: #946200;
      --bad: #9a3b33;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: radial-gradient(circle at top left, #fffaf0 0, var(--bg) 38rem);
      color: var(--ink);
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 44px 0 64px;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
      margin-bottom: 28px;
    }

    h1, h2, h3, h4, p { margin: 0; }

    h1 {
      font-size: clamp(2rem, 5vw, 4.1rem);
      line-height: .98;
      letter-spacing: 0;
      max-width: 760px;
    }

    .summary {
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.55;
      max-width: 700px;
      margin-top: 16px;
    }

    .meta {
      display: grid;
      gap: 8px;
      min-width: 220px;
      color: var(--muted);
      font-size: .82rem;
      text-align: right;
    }

    .meta a { color: var(--accent); }

    .panel {
      background: color-mix(in srgb, var(--paper) 94%, white);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(44, 36, 22, .08);
      overflow: hidden;
    }

    .legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, .48);
      color: var(--muted);
      font-size: .82rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .03em;
      text-transform: uppercase;
      line-height: 1.3;
      white-space: nowrap;
    }

    .badge--exact { background: #dff1e6; color: var(--good); }
    .badge--approx { background: #f9eac8; color: var(--warn); }
    .badge--gap { background: #f4d8d5; color: var(--bad); }
    .badge--custom { background: var(--accent-soft); color: var(--accent); }
    .badge--fallback { background: #e7e1d5; color: #625c50; }

    .taxonomy-section {
      margin: 0 0 24px;
    }

    .meal-icons-section {
      margin: 0 0 24px;
    }

    .taxonomy-section h2,
    .meal-icons-section h2 {
      font-size: 1.45rem;
      margin-bottom: 6px;
    }

    .taxonomy-section > p,
    .meal-icons-section > p {
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 14px;
      max-width: 780px;
    }

    .taxonomy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }

    .taxonomy-card {
      background: rgba(255, 253, 248, .72);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }

    .taxonomy-card h3 {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      font-size: .94rem;
      margin-bottom: 5px;
    }

    .taxonomy-card h3 span {
      color: var(--muted);
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .taxonomy-card p {
      color: var(--muted);
      font-size: .78rem;
      margin-bottom: 10px;
    }

    .taxonomy-children {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .taxonomy-children code {
      border-radius: 999px;
      background: #f1ece2;
      padding: 3px 7px;
      color: #5d564a;
      font-size: .68rem;
    }

    .meal-taxonomy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }

    .meal-taxonomy-card {
      background: rgba(255, 253, 248, .72);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }

    .meal-taxonomy-card h3 {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      font-size: .94rem;
      margin-bottom: 5px;
    }

    .meal-taxonomy-card h3 span {
      color: var(--muted);
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .meal-taxonomy-card p {
      color: var(--muted);
      font-size: .78rem;
    }

    .sheet {
      width: 100%;
      border-collapse: collapse;
    }

    .sheet th, .sheet td {
      border-bottom: 1px solid var(--line);
      padding: 14px;
      vertical-align: top;
    }

    .sheet thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f9f5ed;
      color: var(--muted);
      font-size: .74rem;
      letter-spacing: .08em;
      text-align: left;
      text-transform: uppercase;
    }

    .sheet tbody th {
      width: 220px;
      text-align: left;
      font-weight: 700;
    }

    .sheet tbody th code {
      display: block;
      font-size: .88rem;
      color: var(--ink);
    }

    .sheet tbody th span {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-size: .78rem;
      font-weight: 500;
      line-height: 1.35;
    }

    .group-divider th {
      background: #f3eadc;
      border-top: 1px solid #d2c5b4;
      color: var(--accent);
      padding: 11px 14px;
    }

    .group-divider code {
      font-size: .86rem;
    }

    .group-divider span {
      display: inline;
      margin-left: 10px;
      color: var(--muted);
      font-size: .78rem;
      font-weight: 600;
    }

    .tier-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .03em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .tier-pill--tier-1 { background: var(--accent-soft); color: var(--accent); }
    .tier-pill--tier-2 { background: #e5edf4; color: #315f7c; }
    .tier-pill--fallback { background: #ece8df; color: #625c50; }
    .tier-pill--meal { background: #ece7f3; color: #685383; }
    .muted { color: var(--muted); }

    .icon-card {
      display: grid;
      grid-template-columns: 66px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      min-width: 190px;
    }

    .icon-frame {
      width: 58px;
      height: 58px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: color-mix(in srgb, var(--accent) 10%, var(--paper));
      color: color-mix(in srgb, var(--accent) 68%, var(--ink));
    }

    .icon-frame svg {
      width: 34px;
      height: 34px;
      display: block;
    }

    .icon-frame--phosphor svg {
      color: #3e3a32;
      fill: currentColor;
      stroke: none;
    }

    .icon-frame--fluent {
      background: #fff;
    }

    .icon-frame--fluent svg {
      width: 40px;
      height: 40px;
    }

    .icon-card--empty .icon-frame {
      background: #f3f0e8;
      color: #aaa292;
      border-style: dashed;
    }

    .missing-mark {
      font-size: .8rem;
      letter-spacing: .08em;
    }

    .icon-note {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
      color: var(--muted);
      font-size: .76rem;
      line-height: 1.35;
    }

    .scale-section {
      margin-top: 34px;
    }

    .scale-section h2 {
      font-size: 1.45rem;
      margin-bottom: 6px;
    }

    .scale-section > p {
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .scale-row {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .scale-row h3 {
      display: flex;
      gap: 10px;
      align-items: baseline;
      font-size: .95rem;
      margin-bottom: 14px;
    }

    .scale-row h3 span {
      color: var(--muted);
      font-size: .8rem;
      font-weight: 500;
    }

    .scale-families {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .scale-families h4 {
      color: var(--muted);
      font-size: .72rem;
      letter-spacing: .08em;
      margin-bottom: 9px;
      text-transform: uppercase;
    }

    .scale-strip {
      display: flex;
      align-items: end;
      gap: 12px;
      min-height: 64px;
    }

    .scale-item {
      display: grid;
      justify-items: center;
      gap: 6px;
      min-width: 42px;
    }

    .scale-icon {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: color-mix(in srgb, var(--accent) 65%, var(--ink));
    }

    .scale-icon svg {
      width: var(--icon-size);
      height: var(--icon-size);
    }

    .scale-icon--phosphor svg {
      fill: currentColor;
      stroke: none;
    }

    .scale-item small {
      color: var(--muted);
      font-size: .66rem;
    }

    .scale-gap {
      align-self: center;
      color: var(--bad);
      font-size: .78rem;
    }

    .notes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin: 22px 0 0;
    }

    .note {
      padding: 14px 16px;
      background: rgba(255, 253, 248, .72);
      border: 1px solid var(--line);
      border-radius: 12px;
      color: var(--muted);
      font-size: .84rem;
      line-height: 1.45;
    }

    .note strong {
      display: block;
      margin-bottom: 4px;
      color: var(--ink);
    }

    @media (max-width: 860px) {
      main { width: min(100vw - 20px, 760px); padding-top: 26px; }
      header { grid-template-columns: 1fr; }
      .meta { text-align: left; }
      .panel { overflow-x: auto; }
      .sheet { min-width: 1120px; }
      .meal-sheet {
        min-width: 0;
      }
      .meal-sheet thead {
        display: none;
      }
      .meal-sheet,
      .meal-sheet tbody,
      .meal-sheet tr,
      .meal-sheet th,
      .meal-sheet td {
        display: block;
        width: 100%;
      }
      .meal-sheet tr {
        padding: 14px;
        border-bottom: 1px solid var(--line);
      }
      .meal-sheet tr:last-child {
        border-bottom: 0;
      }
      .meal-sheet th,
      .meal-sheet td {
        border-bottom: 0;
        padding: 6px 0;
      }
      .meal-sheet tbody th {
        width: 100%;
      }
      .meal-sheet td:nth-child(2),
      .meal-sheet td:nth-child(3) {
        color: var(--muted);
        font-size: .82rem;
      }
      .meal-sheet td:nth-child(2)::before,
      .meal-sheet td:nth-child(3)::before,
      .meal-sheet td:nth-child(4)::before,
      .meal-sheet td:nth-child(5)::before,
      .meal-sheet td:nth-child(6)::before {
        display: block;
        margin-bottom: 5px;
        color: var(--muted);
        font-size: .68rem;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .meal-sheet td:nth-child(2)::before { content: "Taxonomy"; }
      .meal-sheet td:nth-child(3)::before { content: "Intended cue"; }
      .meal-sheet td:nth-child(4)::before { content: "Custom monoline"; }
      .meal-sheet td:nth-child(5)::before { content: "Sourced outline"; }
      .meal-sheet td:nth-child(6)::before { content: "Fluent color"; }
      .meal-sheet .icon-card {
        min-width: 0;
      }
      .scale-families, .notes { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Food icon contact sheets</h1>
        <p class="summary">Three taxonomy-aligned directions for the calorie tracker food icons: a custom house monoline pass, a sourced outline benchmark, and a full-color Fluent Emoji pass. Rows follow the app's visual-first two-tier taxonomy, and runtime app rendering is not changed by this artifact.</p>
      </div>
      <div class="meta">
        <span>${groupKeys.length} Tier-1 groups</span>
        <span>${tier2.length} Tier-2 categories</span>
        <span>${mealKeys.length} meal buckets</span>
        <span>${FALLBACK_KEYS.length} fallbacks</span>
        <span>Generated by <code>web/scripts/buildFoodIconContactSheets.mjs</code></span>
        <a href="./SOURCES.md">Source and license notes</a>
      </div>
    </header>

    <section class="taxonomy-section" aria-label="Taxonomy map">
      <h2>Taxonomy map</h2>
      <p>Tier-1 groups are stable icon fallbacks. Tier-2 categories refine the visual where a distinct icon exists; otherwise they intentionally inherit the parent group.</p>
      <div class="taxonomy-grid">
        ${renderTaxonomyOverview(groupKeys, byParent)}
      </div>
    </section>

    <section class="meal-icons-section" aria-label="Meal icon directions">
      <h2>Meal icon directions</h2>
      <p>Meal icons are a separate app taxonomy from food categories. These are for breakfast, lunch, dinner, and snacks as meal buckets, so the candidates lean on time-of-day cues instead of repeating individual food category icons.</p>
      <div class="meal-taxonomy-grid">
        ${renderMealTaxonomy(mealKeys, mealLabels)}
      </div>
      <section class="panel" aria-label="Meal icon comparison grid">
        <table class="sheet meal-sheet">
          <thead>
            <tr>
              <th>Meal</th>
              <th>Taxonomy</th>
              <th>Intended cue</th>
              <th>Custom monoline</th>
              <th>Sourced outline benchmark</th>
              <th>Fluent Emoji Flat color</th>
            </tr>
          </thead>
          <tbody>
            ${renderMealRows(mealKeys, mealLabels, mealAssets)}
          </tbody>
        </table>
      </section>
    </section>

    <section class="panel" aria-label="Food icon comparison grid">
      <div class="legend">
        <span class="badge badge--custom">custom</span><span>house-authored line direction</span>
        <span class="badge badge--exact">exact</span><span>source matches the category closely</span>
        <span class="badge badge--approx">approx</span><span>usable but semantically imperfect</span>
        <span class="badge badge--gap">gap</span><span>source family lacks a good glyph</span>
      </div>
      <table class="sheet">
        <thead>
          <tr>
            <th>Category</th>
            <th>Tier</th>
            <th>Parent</th>
            <th>Custom monoline</th>
            <th>Sourced outline benchmark</th>
            <th>Fluent Emoji Flat color</th>
          </tr>
        </thead>
        <tbody>
          ${renderRows(records, assets)}
        </tbody>
      </table>
    </section>

    <section class="scale-section" aria-label="Scale strip">
      <h2>Small-size readability strip</h2>
      <p>The hardest and most overloaded categories are shown at 18px, 20px, and 32px so the set can be judged at actual row-chip size before any app integration.</p>
      ${renderScaleStrips(assets)}
    </section>

    <section class="notes" aria-label="Direction notes">
      <div class="note"><strong>Custom monoline</strong>Best control over taxonomy fit and theme tinting. Requires cleanup and consistency review, but avoids third-party coverage gaps.</div>
      <div class="note"><strong>Sourced outline benchmark</strong>Useful as a style comparison, but Phosphor regular has real food coverage gaps for this taxonomy.</div>
      <div class="note"><strong>Fluent color</strong>Broad, warm, food-specific coverage. Needs a quieter chip treatment if promoted from prototype to runtime UI.</div>
    </section>
  </main>
</body>
</html>
`
}

function renderSources(records, groupKeys, tier2, mealKeys, mealLabels) {
  const phosphorRows = records
    .map((record) => ({ record, meta: phosphorMeta(record) }))
    .filter(({ meta }) => meta?.icon)
    .map(({ record, meta }) => (
      `| \`${record.key}\` | ${record.tier} | ${record.parent ? `\`${record.parent}\`` : '--'} | ${meta.badge} | ${meta.icon} | ${sourceUrlForPhosphor(meta.icon)} |`
    ))
    .join('\n')
  const fluentRows = records
    .map((record) => ({ record, meta: fluentMeta(record) }))
    .filter(({ meta }) => meta?.folder)
    .map(({ record, meta }) => (
      `| \`${record.key}\` | ${record.tier} | ${record.parent ? `\`${record.parent}\`` : '--'} | ${meta.badge} | ${meta.folder} / ${meta.file} | ${sourceUrlForFluent(meta)} |`
    ))
    .join('\n')
  const phosphorMealRows = mealKeys
    .map((key) => ({ key, meta: mealPhosphorMeta(key) }))
    .filter(({ meta }) => meta?.icon)
    .map(({ key, meta }) => (
      `| \`${key}\` | ${mealLabels[key] || titleizeKey(key)} | ${meta.badge} | ${meta.icon} | ${sourceUrlForPhosphor(meta.icon)} |`
    ))
    .join('\n')
  const fluentMealRows = mealKeys
    .map((key) => ({ key, meta: mealFluentMeta(key) }))
    .filter(({ meta }) => meta?.folder)
    .map(({ key, meta }) => (
      `| \`${key}\` | ${mealLabels[key] || titleizeKey(key)} | ${meta.badge} | ${meta.folder} / ${meta.file} | ${sourceUrlForFluent(meta)} |`
    ))
    .join('\n')

  return `# Food icon contact sheet sources

Generated by \`web/scripts/buildFoodIconContactSheets.mjs\`.

This artifact is for visual review only. It does not change the runtime food icon resolver or app rendering.

## Taxonomy coverage

- Tier-1 groups: ${groupKeys.length}
- Tier-2 categories: ${tier2.length}
- Meal buckets: ${mealKeys.length}
- Fallback keys: ${FALLBACK_KEYS.length}
- Total rendered category rows: ${records.length}

## Licenses

- ${PHOSPHOR_LICENSE.label}: ${PHOSPHOR_LICENSE.license}, ${PHOSPHOR_LICENSE.licenseUrl}
- ${FLUENT_LICENSE.label}: ${FLUENT_LICENSE.license}, ${FLUENT_LICENSE.licenseUrl}
- Custom monoline icons: authored in this repository for review.

OpenMoji is intentionally excluded from the generated sheets because its CC BY-SA license adds share-alike obligations for adapted icon assets.

## Phosphor regular assets

| Category | Tier | Parent | Status | Asset | Source URL |
|---|---|---|---|---|---|
${phosphorRows}

## Meal Phosphor regular assets

| Meal | Label | Status | Asset | Source URL |
|---|---|---|---|---|
${phosphorMealRows}

## Fluent Emoji Flat assets

| Category | Tier | Parent | Status | Asset | Source URL |
|---|---|---|---|---|---|
${fluentRows}

## Meal Fluent Emoji Flat assets

| Meal | Label | Status | Asset | Source URL |
|---|---|---|---|---|
${fluentMealRows}
`
}

async function main() {
  const taxonomy = await readFile(taxonomyPath, 'utf8')
  const meals = await readFile(mealsPath, 'utf8')
  const groupKeys = parseGroupKeys(taxonomy)
  const tier2 = parseTier2Parents(taxonomy)
  const byParent = groupTier2ByParent(tier2)
  const records = buildRecords(groupKeys, tier2)
  const mealKeys = parseMealOrder(meals)
  const mealLabels = parseMealLabels(meals)

  for (const { key, parent, tier } of records) {
    if (tier === 'Tier 1' && !SUBJECTS[key]) throw new Error(`Missing subject for ${key}`)
    if (!customMeta({ key, parent }).icon) throw new Error(`Missing custom icon fallback for ${key}`)
    if (!phosphorMeta({ key, parent }).badge) throw new Error(`Missing Phosphor status for ${key}`)
    if (!fluentMeta({ key, parent }).badge) throw new Error(`Missing Fluent status for ${key}`)
  }

  for (const key of mealKeys) {
    if (!MEAL_SUBJECTS[key]) throw new Error(`Missing meal subject for ${key}`)
    if (!mealLabels[key]) throw new Error(`Missing meal label for ${key}`)
    if (!mealCustomMeta(key).icon) throw new Error(`Missing custom meal icon for ${key}`)
    if (!mealPhosphorMeta(key).badge) throw new Error(`Missing Phosphor meal status for ${key}`)
    if (!mealFluentMeta(key).badge) throw new Error(`Missing Fluent meal status for ${key}`)
  }

  for (const key of SCALE_KEYS) {
    if (!groupKeys.includes(key)) throw new Error(`Scale key is not a Tier-1 group: ${key}`)
  }

  const assets = await loadRemoteAssets(records)
  const mealAssets = await loadMealRemoteAssets(mealKeys)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'index.html'), renderHtml({
    groupKeys,
    tier2,
    byParent,
    records,
    assets,
    mealKeys,
    mealLabels,
    mealAssets,
  }))
  await writeFile(path.join(outDir, 'SOURCES.md'), renderSources(records, groupKeys, tier2, mealKeys, mealLabels))

  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, 'index.html'))}`)
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, 'SOURCES.md'))}`)
  console.log(`${records.length} taxonomy keys included: ${groupKeys.length} Tier-1, ${tier2.length} Tier-2, ${FALLBACK_KEYS.length} fallbacks`)
  console.log(`${mealKeys.length} meal buckets included: ${mealKeys.join(', ')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
