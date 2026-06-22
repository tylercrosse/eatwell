# Food category icons — manifest & style guide

These icons render as the leading glyph of every diary entry row (M11.3). They are
the app's visual identity at the row level, so they must feel like **one family**.

The taxonomy that maps a food to a category key lives in
[`web/src/lib/foodCategory.ts`](../../lib/foodCategory.ts) (mirrors
[`app/categories.py`](../../../../app/categories.py)); this folder is the **asset
layer** — the `category key → SVG` half of the design. Swapping these files
re-skins the app without touching the resolver.

## Visual style

A single, calm, monochrome **line** family. The icon depicts **visual form** —
the vessel a food is served in or its characteristic silhouette — never a
nutritional concept.

- **Line, not fill.** Open stroke work only; no solid shapes, no two-tone, no
  color. (This is the "mono line, theme-tinted" decision; duotone/color is a
  later asset-only swap.)
- **Stroke:** ~2px on a **24×24** grid, `round` linecap **and** linejoin. Matches
  Lucide's defaults so Lucide icons and our top-ups look identical. Restyle any
  vendored/borrowed SVG to this weight before committing it.
- **Color = `currentColor`.** Never hard-code a color. The glyph inherits the
  chip's text color (a theme token), which is what keeps the set cohesive across
  all 5 themes including the dark base. The chip, not the glyph, owns any tint.
- **Grid & optical weight:** 24×24 viewBox, ~20px live area with ~2px padding.
  Normalize so every glyph carries similar optical mass — a `bowl` and an `apple`
  should feel the same size in the chip; scale small subjects up to fill.
- **Low detail budget.** Each icon must read at **18–20px** (the chip glyph
  size). No fine interior detail, no text, no tiny seeds. Suggest contents with
  1–3 strokes (e.g. a bowl outline + two wavy lines = "something in a bowl").
- **Silhouette-first, most-iconic angle.** Side view for mugs/glasses, 3/4 for
  bowls/plates, top-down wedge for pizza. Recognizable by outline alone.
- **Reuse base shapes within a family.** One bowl outline across the bowl family
  (vary only the contents lines); one plate ellipse across the plate family; one
  glass/mug baseline across drinks. This is what makes refinements look related
  instead of like 100 unrelated doodles.

### Runtime row treatment (set in `index.css`, not in the SVG)

- Transparent fixed frame; no border, no circular background.
- Current runtime size: 36px frame with a 24px glyph.
- One uniform treatment for all categories in Wave A — keep it quiet.
- Decorative: `aria-hidden` on the SVG; the food name is the accessible label.

## Tier-1 group icons (all required in Wave A)

Every group must ship with an icon — they are the honest fallback when a Tier-2
refinement is missing. "Source" lists a likely Lucide name (verify it exists in
the installed version) and the OpenMoji emoji to vendor as a line SVG if not.

| Key | Depicts | Source candidate |
|---|---|---|
| `handheld` | Stacked burger/sandwich, side view | Lucide `sandwich` · OpenMoji 🥪 |
| `bowl` | Round bowl, 3/4 view, 2 wavy content lines | custom (family base) · OpenMoji 🥣 |
| `plate` | Plate ellipse with a small food mound | custom · OpenMoji 🍽️ (+ mound) |
| `pizza` | Single slice (triangle), top-down | Lucide `pizza` · OpenMoji 🍕 |
| `pasta` | Bowl with a fork twirling noodles | custom · OpenMoji 🍝 |
| `salad` | Bowl with leafy fronds rising | Lucide `salad` · OpenMoji 🥗 |
| `soup_stew` | Bowl with steam lines + spoon | Lucide `soup`/`cooking-pot` · OpenMoji 🍲 |
| `taco_burrito` | Folded taco shell (U), side view | custom · OpenMoji 🌮 |
| `pastry` | Croissant crescent | Lucide `croissant` · OpenMoji 🥐 |
| `hot_drink` | Mug with handle + steam | Lucide `coffee` · OpenMoji ☕ |
| `cold_drink` | Tumbler glass with straw | Lucide `cup-soda`/`glass-water` · OpenMoji 🥤 |
| `alcohol` | Wine glass | Lucide `wine` · OpenMoji 🍷 |
| `fruit` | Apple with a leaf | Lucide `apple` · OpenMoji 🍎 |
| `vegetables` | Carrot | Lucide `carrot` · OpenMoji 🥕 |
| `protein` | Drumstick | Lucide `drumstick`/`beef` · OpenMoji 🍗 |
| `grains_bread` | Bread loaf | Lucide `wheat` (or loaf) · OpenMoji 🍞 |
| `dairy` | Cheese wedge | Lucide `milk` (or wedge) · OpenMoji 🧀 |
| `snacks` | Popcorn tub / snack bag | custom · OpenMoji 🍿 |
| `sweets` | Cake slice | Lucide `cake`/`cake-slice` · OpenMoji 🍰 |
| `extras` | Small condiment bottle | custom · OpenMoji 🫙 |

### Fallback glyphs

| Key | Depicts | Source candidate |
|---|---|---|
| `food_generic` | Crossed fork + knife (no plate food) | Lucide `utensils` · OpenMoji 🍴 |
| `beverage_generic` | Plain cup, no contents | Lucide `cup-soda` · OpenMoji 🥤 |

Keep `food_generic` distinct from `plate`: `plate` shows food on the plate;
`food_generic` is bare cutlery so it reads as "uncategorized," not as a dish.

## Priority Tier-2 leaf icons (add where they add recognizability)

Not exhaustive — only the high-frequency, **visually distinct** refinements worth
a dedicated glyph early. Anything without its own icon falls back to its group
icon via `iconFor()`, so this list can grow over waves driven by the category
audit.

| Group | Leaf icons worth adding first |
|---|---|
| `handheld` | `burger` (distinct from generic `sandwich`), `hot_dog`, `wrap` |
| `taco_burrito` | `burrito` (rolled) vs the `taco` group shell |
| `bowl` | `sushi` (rolls), `ramen`/`pho` (chopsticks + steam), `oatmeal` |
| `plate` | `fried_chicken` (drumstick), `bbq_skewer` |
| `protein` | `eggs_omelet`, `fish`, `bacon`→`pork` |
| `fruit` | `banana`, `berries`, `citrus` (3 most-logged silhouettes) |
| `vegetables` | `leafy_greens`, `avocado`, `potato` |
| `dairy` | `milk` vs `yogurt` vs `cheese` |
| `grains_bread` | `rice` (bowl of grains), `bagel_toast` |
| `hot_drink` | `tea` (cup + tag) vs `coffee` mug |
| `cold_drink` | `water`, `smoothie`, `soda` glass variants |
| `alcohol` | `beer` (pint), `cocktail` (martini) vs `wine` |
| `sweets` | `donut`, `cookie`, `ice_cream`, `cake` |
| `pastry` | `muffin`, `donut`-style (if not in sweets), `bagel_plain` |
| `snacks` | `nuts_seeds`, `chips`, `popcorn` |

## Sourcing & licensing

- **Fluent Emoji Flat** (Microsoft, MIT) — current runtime family for food and
  meal icons. SVGs are vendored under `fluent/` and imported as Vite asset URLs
  from `foodCategoryIcons.tsx` / `mealIcons.ts`.
- **Lucide** (`lucide-react`, ISC) — kept as an installed dependency for now but
  no longer drives the food icon runtime map.
- **OpenMoji** (openmoji.org, **CC BY-SA 4.0**) — reference only for now; do not
  vendor adapted assets without recording attribution and share-alike impact.
- **Custom** — still useful for a later bespoke line or duotone family if the
  Fluent direction feels too visually loud in production.

The runtime map and review contact sheet should stay aligned through
`web/scripts/buildFoodIconContactSheets.mjs`. Runtime swaps should only touch the
vendored assets plus the maps in `foodCategoryIcons.tsx` / `mealIcons.ts`; the
taxonomy/resolver should not need to change for an asset-family swap.
