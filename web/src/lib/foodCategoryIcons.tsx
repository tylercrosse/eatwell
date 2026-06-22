// category key -> icon component. The ONLY file to touch when re-skinning the icon style
// (line -> duotone -> custom/generated art). Wave A uses lucide-react line icons; a few
// dish silhouettes lucide lacks (pasta, taco/burrito, sushi…) fall back to their vessel
// group's icon and are marked TODO(icon-art) for the custom-illustration wave.

import {
  Apple,
  Banana,
  Bean,
  Beef,
  Beer,
  Cake,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  EggFried,
  Fish,
  GlassWater,
  Grape,
  Hamburger,
  Ham,
  IceCream,
  LeafyGreen,
  type LucideIcon,
  Martini,
  Milk,
  Nut,
  Package,
  Pill,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Shrimp,
  Soup,
  Utensils,
  Wheat,
  Wine,
} from 'lucide-react'
import { FOOD_GENERIC, groupOf } from './foodCategory'

// All ~20 Tier-1 groups have an icon; Tier-2 keys only when lucide has a distinct glyph
// (others inherit their group icon via iconFor). Collisions are honest Wave-A placeholders.
const ICONS: Record<string, LucideIcon> = {
  // --- Tier-1 groups ---
  handheld: Sandwich,
  bowl: Soup,
  plate: Utensils,
  pizza: Pizza,
  pasta: Utensils, // TODO(icon-art): noodle glyph
  salad: Salad,
  soup_stew: CookingPot,
  taco_burrito: Sandwich, // TODO(icon-art): taco glyph
  pastry: Croissant,
  hot_drink: Coffee,
  cold_drink: CupSoda,
  alcohol: Wine,
  fruit: Apple,
  vegetables: Carrot,
  protein: Beef,
  grains_bread: Wheat,
  dairy: Milk,
  snacks: Popcorn,
  sweets: Cake,
  extras: Package,
  // --- Terminal fallbacks ---
  food_generic: Utensils,
  beverage_generic: GlassWater,
  // --- Tier-2 leaves with a distinct lucide glyph ---
  burger: Hamburger,
  banana: Banana,
  apple_pear: Apple,
  berries: Cherry,
  citrus: Citrus,
  grapes: Grape,
  leafy_greens: LeafyGreen,
  fish: Fish,
  shellfish: Shrimp,
  fried_seafood: Shrimp,
  poultry: Drumstick,
  fried_chicken: Drumstick,
  pork: Ham,
  eggs_omelet: EggFried,
  beans_legumes: Bean,
  nuts_seeds: Nut,
  soup_broth: Soup,
  ramen: Soup,
  pho: Soup,
  croissant: Croissant,
  coffee: Coffee,
  latte_cappuccino: Coffee,
  iced_coffee: Coffee,
  water: GlassWater,
  soda: CupSoda,
  beer: Beer,
  wine: Wine,
  cocktail: Martini,
  spirits: Martini,
  ice_cream: IceCream,
  donut: Donut,
  cookie: Cookie,
  candy: Candy,
  popcorn: Popcorn,
  supplement: Pill,
}

/** The icon for a category key: its own glyph, else its group's, else the generic plate. */
export function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? ICONS[groupOf(key) ?? ''] ?? ICONS[FOOD_GENERIC]
}
