// category key -> Fluent Emoji Flat SVG asset. Keep this map aligned with
// web/scripts/buildFoodIconContactSheets.mjs so the runtime and review sheet compare
// the same sourced family.

import { FOOD_GENERIC, groupOf } from './foodCategory'
import type { IconAsset } from './iconAssets'
import avocadoFlatSvg from '../assets/food-icons/fluent/avocado_flat.svg'
import baconFlatSvg from '../assets/food-icons/fluent/bacon_flat.svg'
import bagelFlatSvg from '../assets/food-icons/fluent/bagel_flat.svg'
import bananaFlatSvg from '../assets/food-icons/fluent/banana_flat.svg'
import beansFlatSvg from '../assets/food-icons/fluent/beans_flat.svg'
import beerMugFlatSvg from '../assets/food-icons/fluent/beer_mug_flat.svg'
import beverageBoxFlatSvg from '../assets/food-icons/fluent/beverage_box_flat.svg'
import blueberriesFlatSvg from '../assets/food-icons/fluent/blueberries_flat.svg'
import bowlWithSpoonFlatSvg from '../assets/food-icons/fluent/bowl_with_spoon_flat.svg'
import breadFlatSvg from '../assets/food-icons/fluent/bread_flat.svg'
import broccoliFlatSvg from '../assets/food-icons/fluent/broccoli_flat.svg'
import burritoFlatSvg from '../assets/food-icons/fluent/burrito_flat.svg'
import butterFlatSvg from '../assets/food-icons/fluent/butter_flat.svg'
import candyFlatSvg from '../assets/food-icons/fluent/candy_flat.svg'
import carrotFlatSvg from '../assets/food-icons/fluent/carrot_flat.svg'
import cheeseWedgeFlatSvg from '../assets/food-icons/fluent/cheese_wedge_flat.svg'
import chocolateBarFlatSvg from '../assets/food-icons/fluent/chocolate_bar_flat.svg'
import cocktailGlassFlatSvg from '../assets/food-icons/fluent/cocktail_glass_flat.svg'
import cookedRiceFlatSvg from '../assets/food-icons/fluent/cooked_rice_flat.svg'
import cookieFlatSvg from '../assets/food-icons/fluent/cookie_flat.svg'
import croissantFlatSvg from '../assets/food-icons/fluent/croissant_flat.svg'
import cupWithStrawFlatSvg from '../assets/food-icons/fluent/cup_with_straw_flat.svg'
import cupcakeFlatSvg from '../assets/food-icons/fluent/cupcake_flat.svg'
import curryRiceFlatSvg from '../assets/food-icons/fluent/curry_rice_flat.svg'
import cutOfMeatFlatSvg from '../assets/food-icons/fluent/cut_of_meat_flat.svg'
import doughnutFlatSvg from '../assets/food-icons/fluent/doughnut_flat.svg'
import dumplingFlatSvg from '../assets/food-icons/fluent/dumpling_flat.svg'
import earOfCornFlatSvg from '../assets/food-icons/fluent/ear_of_corn_flat.svg'
import eggFlatSvg from '../assets/food-icons/fluent/egg_flat.svg'
import fishFlatSvg from '../assets/food-icons/fluent/fish_flat.svg'
import flatbreadFlatSvg from '../assets/food-icons/fluent/flatbread_flat.svg'
import forkAndKnifeFlatSvg from '../assets/food-icons/fluent/fork_and_knife_flat.svg'
import forkAndKnifeWithPlateFlatSvg from '../assets/food-icons/fluent/fork_and_knife_with_plate_flat.svg'
import frenchFriesFlatSvg from '../assets/food-icons/fluent/french_fries_flat.svg'
import friedShrimpFlatSvg from '../assets/food-icons/fluent/fried_shrimp_flat.svg'
import glassOfMilkFlatSvg from '../assets/food-icons/fluent/glass_of_milk_flat.svg'
import grapesFlatSvg from '../assets/food-icons/fluent/grapes_flat.svg'
import greenSaladFlatSvg from '../assets/food-icons/fluent/green_salad_flat.svg'
import hamburgerFlatSvg from '../assets/food-icons/fluent/hamburger_flat.svg'
import honeyPotFlatSvg from '../assets/food-icons/fluent/honey_pot_flat.svg'
import hotBeverageFlatSvg from '../assets/food-icons/fluent/hot_beverage_flat.svg'
import hotDogFlatSvg from '../assets/food-icons/fluent/hot_dog_flat.svg'
import jarFlatSvg from '../assets/food-icons/fluent/jar_flat.svg'
import leafyGreenFlatSvg from '../assets/food-icons/fluent/leafy_green_flat.svg'
import mangoFlatSvg from '../assets/food-icons/fluent/mango_flat.svg'
import melonFlatSvg from '../assets/food-icons/fluent/melon_flat.svg'
import mushroomFlatSvg from '../assets/food-icons/fluent/mushroom_flat.svg'
import pancakesFlatSvg from '../assets/food-icons/fluent/pancakes_flat.svg'
import peanutsFlatSvg from '../assets/food-icons/fluent/peanuts_flat.svg'
import pieFlatSvg from '../assets/food-icons/fluent/pie_flat.svg'
import pillFlatSvg from '../assets/food-icons/fluent/pill_flat.svg'
import pizzaFlatSvg from '../assets/food-icons/fluent/pizza_flat.svg'
import popcornFlatSvg from '../assets/food-icons/fluent/popcorn_flat.svg'
import potOfFoodFlatSvg from '../assets/food-icons/fluent/pot_of_food_flat.svg'
import potableWaterFlatSvg from '../assets/food-icons/fluent/potable_water_flat.svg'
import potatoFlatSvg from '../assets/food-icons/fluent/potato_flat.svg'
import poultryLegFlatSvg from '../assets/food-icons/fluent/poultry_leg_flat.svg'
import pouringLiquidFlatSvg from '../assets/food-icons/fluent/pouring_liquid_flat.svg'
import pretzelFlatSvg from '../assets/food-icons/fluent/pretzel_flat.svg'
import redAppleFlatSvg from '../assets/food-icons/fluent/red_apple_flat.svg'
import riceCrackerFlatSvg from '../assets/food-icons/fluent/rice_cracker_flat.svg'
import sandwichFlatSvg from '../assets/food-icons/fluent/sandwich_flat.svg'
import shallowPanOfFoodFlatSvg from '../assets/food-icons/fluent/shallow_pan_of_food_flat.svg'
import shortcakeFlatSvg from '../assets/food-icons/fluent/shortcake_flat.svg'
import shrimpFlatSvg from '../assets/food-icons/fluent/shrimp_flat.svg'
import softIceCreamFlatSvg from '../assets/food-icons/fluent/soft_ice_cream_flat.svg'
import spaghettiFlatSvg from '../assets/food-icons/fluent/spaghetti_flat.svg'
import steamingBowlFlatSvg from '../assets/food-icons/fluent/steaming_bowl_flat.svg'
import stuffedFlatbreadFlatSvg from '../assets/food-icons/fluent/stuffed_flatbread_flat.svg'
import sushiFlatSvg from '../assets/food-icons/fluent/sushi_flat.svg'
import tacoFlatSvg from '../assets/food-icons/fluent/taco_flat.svg'
import tangerineFlatSvg from '../assets/food-icons/fluent/tangerine_flat.svg'
import teacupWithoutHandleFlatSvg from '../assets/food-icons/fluent/teacup_without_handle_flat.svg'
import tomatoFlatSvg from '../assets/food-icons/fluent/tomato_flat.svg'
import tumblerGlassFlatSvg from '../assets/food-icons/fluent/tumbler_glass_flat.svg'
import wineGlassFlatSvg from '../assets/food-icons/fluent/wine_glass_flat.svg'

const ICONS: Record<string, IconAsset> = {
  "handheld": { src: sandwichFlatSvg, label: 'Sandwich' },
  "bowl": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "plate": { src: forkAndKnifeWithPlateFlatSvg, label: 'Fork and knife with plate' },
  "pizza": { src: pizzaFlatSvg, label: 'Pizza' },
  "pasta": { src: spaghettiFlatSvg, label: 'Spaghetti' },
  "salad": { src: greenSaladFlatSvg, label: 'Green salad' },
  "soup_stew": { src: potOfFoodFlatSvg, label: 'Pot of food' },
  "taco_burrito": { src: tacoFlatSvg, label: 'Taco' },
  "pastry": { src: croissantFlatSvg, label: 'Croissant' },
  "hot_drink": { src: hotBeverageFlatSvg, label: 'Hot beverage' },
  "cold_drink": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "alcohol": { src: wineGlassFlatSvg, label: 'Wine glass' },
  "fruit": { src: redAppleFlatSvg, label: 'Red apple' },
  "vegetables": { src: carrotFlatSvg, label: 'Carrot' },
  "protein": { src: poultryLegFlatSvg, label: 'Poultry leg' },
  "grains_bread": { src: breadFlatSvg, label: 'Bread' },
  "dairy": { src: cheeseWedgeFlatSvg, label: 'Cheese wedge' },
  "snacks": { src: popcornFlatSvg, label: 'Popcorn' },
  "sweets": { src: shortcakeFlatSvg, label: 'Shortcake' },
  "extras": { src: jarFlatSvg, label: 'Jar' },
  "burger": { src: hamburgerFlatSvg, label: 'Hamburger' },
  "sandwich": { src: sandwichFlatSvg, label: 'Sandwich' },
  "wrap": { src: stuffedFlatbreadFlatSvg, label: 'Stuffed flatbread' },
  "hot_dog": { src: hotDogFlatSvg, label: 'Hot dog' },
  "taco": { src: tacoFlatSvg, label: 'Taco' },
  "burrito": { src: burritoFlatSvg, label: 'Burrito' },
  "curry_rice": { src: curryRiceFlatSvg, label: 'Curry rice' },
  "ramen": { src: steamingBowlFlatSvg, label: 'Steaming bowl' },
  "pho": { src: steamingBowlFlatSvg, label: 'Steaming bowl' },
  "oatmeal": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "cereal_bowl": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "sushi": { src: sushiFlatSvg, label: 'Sushi' },
  "dumplings": { src: dumplingFlatSvg, label: 'Dumpling' },
  "fried_chicken": { src: poultryLegFlatSvg, label: 'Poultry leg' },
  "fried_seafood": { src: friedShrimpFlatSvg, label: 'Fried shrimp' },
  "casserole_bake": { src: shallowPanOfFoodFlatSvg, label: 'Shallow pan of food' },
  "stir_fry": { src: shallowPanOfFoodFlatSvg, label: 'Shallow pan of food' },
  "green_salad": { src: greenSaladFlatSvg, label: 'Green salad' },
  "soup_broth": { src: potOfFoodFlatSvg, label: 'Pot of food' },
  "flatbread": { src: flatbreadFlatSvg, label: 'Flatbread' },
  "croissant": { src: croissantFlatSvg, label: 'Croissant' },
  "muffin": { src: cupcakeFlatSvg, label: 'Cupcake' },
  "bagel_plain": { src: bagelFlatSvg, label: 'Bagel' },
  "apple_pear": { src: redAppleFlatSvg, label: 'Red apple' },
  "banana": { src: bananaFlatSvg, label: 'Banana' },
  "berries": { src: blueberriesFlatSvg, label: 'Blueberries' },
  "citrus": { src: tangerineFlatSvg, label: 'Tangerine' },
  "grapes": { src: grapesFlatSvg, label: 'Grapes' },
  "melon": { src: melonFlatSvg, label: 'Melon' },
  "tropical_fruit": { src: mangoFlatSvg, label: 'Mango' },
  "leafy_greens": { src: leafyGreenFlatSvg, label: 'Leafy green' },
  "root_veg": { src: carrotFlatSvg, label: 'Carrot' },
  "potato": { src: potatoFlatSvg, label: 'Potato' },
  "tomato": { src: tomatoFlatSvg, label: 'Tomato' },
  "cruciferous": { src: broccoliFlatSvg, label: 'Broccoli' },
  "mushroom": { src: mushroomFlatSvg, label: 'Mushroom' },
  "avocado": { src: avocadoFlatSvg, label: 'Avocado' },
  "corn": { src: earOfCornFlatSvg, label: 'Ear of corn' },
  "poultry": { src: poultryLegFlatSvg, label: 'Poultry leg' },
  "red_meat": { src: cutOfMeatFlatSvg, label: 'Cut of meat' },
  "pork": { src: baconFlatSvg, label: 'Bacon' },
  "fish": { src: fishFlatSvg, label: 'Fish' },
  "shellfish": { src: shrimpFlatSvg, label: 'Shrimp' },
  "eggs_omelet": { src: eggFlatSvg, label: 'Egg' },
  "tofu": { src: beansFlatSvg, label: 'Beans' },
  "beans_legumes": { src: beansFlatSvg, label: 'Beans' },
  "bread": { src: breadFlatSvg, label: 'Bread' },
  "rice": { src: cookedRiceFlatSvg, label: 'Cooked rice' },
  "cereal": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "oats": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "tortilla": { src: flatbreadFlatSvg, label: 'Flatbread' },
  "bagel_toast": { src: bagelFlatSvg, label: 'Bagel' },
  "cheese": { src: cheeseWedgeFlatSvg, label: 'Cheese wedge' },
  "milk": { src: glassOfMilkFlatSvg, label: 'Glass of milk' },
  "yogurt": { src: bowlWithSpoonFlatSvg, label: 'Bowl with spoon' },
  "butter_cream": { src: butterFlatSvg, label: 'Butter' },
  "chips": { src: frenchFriesFlatSvg, label: 'French fries' },
  "crackers": { src: riceCrackerFlatSvg, label: 'Rice cracker' },
  "nuts_seeds": { src: peanutsFlatSvg, label: 'Peanuts' },
  "popcorn": { src: popcornFlatSvg, label: 'Popcorn' },
  "pretzels": { src: pretzelFlatSvg, label: 'Pretzel' },
  "granola_bar": { src: chocolateBarFlatSvg, label: 'Chocolate bar' },
  "jerky": { src: cutOfMeatFlatSvg, label: 'Cut of meat' },
  "chocolate": { src: chocolateBarFlatSvg, label: 'Chocolate bar' },
  "candy": { src: candyFlatSvg, label: 'Candy' },
  "cake": { src: shortcakeFlatSvg, label: 'Shortcake' },
  "cookie": { src: cookieFlatSvg, label: 'Cookie' },
  "donut": { src: doughnutFlatSvg, label: 'Doughnut' },
  "ice_cream": { src: softIceCreamFlatSvg, label: 'Soft ice cream' },
  "pie_tart": { src: pieFlatSvg, label: 'Pie' },
  "pancakes_waffles": { src: pancakesFlatSvg, label: 'Pancakes' },
  "coffee": { src: hotBeverageFlatSvg, label: 'Hot beverage' },
  "tea": { src: teacupWithoutHandleFlatSvg, label: 'Teacup without handle' },
  "latte_cappuccino": { src: hotBeverageFlatSvg, label: 'Hot beverage' },
  "hot_cocoa": { src: hotBeverageFlatSvg, label: 'Hot beverage' },
  "matcha": { src: teacupWithoutHandleFlatSvg, label: 'Teacup without handle' },
  "water": { src: potableWaterFlatSvg, label: 'Potable water' },
  "juice": { src: beverageBoxFlatSvg, label: 'Beverage box' },
  "soda": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "smoothie": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "milk_drink": { src: glassOfMilkFlatSvg, label: 'Glass of milk' },
  "protein_shake": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "energy_drink": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "sports_drink": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "iced_coffee": { src: cupWithStrawFlatSvg, label: 'Cup with straw' },
  "beer": { src: beerMugFlatSvg, label: 'Beer mug' },
  "wine": { src: wineGlassFlatSvg, label: 'Wine glass' },
  "cocktail": { src: cocktailGlassFlatSvg, label: 'Cocktail glass' },
  "spirits": { src: tumblerGlassFlatSvg, label: 'Tumbler glass' },
  "sauce_condiment": { src: jarFlatSvg, label: 'Jar' },
  "dressing": { src: jarFlatSvg, label: 'Jar' },
  "oil": { src: pouringLiquidFlatSvg, label: 'Pouring liquid' },
  "spread": { src: jarFlatSvg, label: 'Jar' },
  "sweetener_syrup": { src: honeyPotFlatSvg, label: 'Honey pot' },
  "supplement": { src: pillFlatSvg, label: 'Pill' },
  "protein_powder": { src: jarFlatSvg, label: 'Jar' },
  "food_generic": { src: forkAndKnifeFlatSvg, label: 'Fork and knife' },
  "beverage_generic": { src: tumblerGlassFlatSvg, label: 'Tumbler glass' },
}

/** The icon for a category key: its own glyph, else its group's, else the generic plate. */
export function iconFor(key: string): IconAsset {
  return ICONS[key] ?? ICONS[groupOf(key) ?? ''] ?? ICONS[FOOD_GENERIC]
}
