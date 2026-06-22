import type { IconAsset } from './iconAssets'
import balanceScaleFlatSvg from '../assets/food-icons/fluent/balance_scale_flat.svg'
import bullseyeFlatSvg from '../assets/food-icons/fluent/bullseye_flat.svg'
import cameraFlatSvg from '../assets/food-icons/fluent/camera_flat.svg'
import chartIncreasingFlatSvg from '../assets/food-icons/fluent/chart_increasing_flat.svg'
import clipboardFlatSvg from '../assets/food-icons/fluent/clipboard_flat.svg'
import fireFlatSvg from '../assets/food-icons/fluent/fire_flat.svg'
import flexedBicepsFlatDefaultSvg from '../assets/food-icons/fluent/flexed_biceps_flat_default.svg'
import gearFlatSvg from '../assets/food-icons/fluent/gear_flat.svg'
import greenSaladFlatSvg from '../assets/food-icons/fluent/green_salad_flat.svg'
import partyPopperFlatSvg from '../assets/food-icons/fluent/party_popper_flat.svg'
import redAppleFlatSvg from '../assets/food-icons/fluent/red_apple_flat.svg'
import runningShoeFlatSvg from '../assets/food-icons/fluent/running_shoe_flat.svg'
import sparklesFlatSvg from '../assets/food-icons/fluent/sparkles_flat.svg'

export type AppIconKey =
  | 'body'
  | 'burn'
  | 'camera'
  | 'exercise'
  | 'food'
  | 'goals'
  | 'guide'
  | 'log'
  | 'party'
  | 'settings'
  | 'sparkles'
  | 'steps'
  | 'trends'

const APP_ICONS: Record<AppIconKey, IconAsset> = {
  body: { src: balanceScaleFlatSvg, label: 'Balance scale' },
  burn: { src: fireFlatSvg, label: 'Fire' },
  camera: { src: cameraFlatSvg, label: 'Camera' },
  exercise: { src: flexedBicepsFlatDefaultSvg, label: 'Flexed biceps' },
  food: { src: redAppleFlatSvg, label: 'Red apple' },
  goals: { src: bullseyeFlatSvg, label: 'Bullseye' },
  guide: { src: greenSaladFlatSvg, label: 'Green salad' },
  log: { src: clipboardFlatSvg, label: 'Clipboard' },
  party: { src: partyPopperFlatSvg, label: 'Party popper' },
  settings: { src: gearFlatSvg, label: 'Gear' },
  sparkles: { src: sparklesFlatSvg, label: 'Sparkles' },
  steps: { src: runningShoeFlatSvg, label: 'Running shoe' },
  trends: { src: chartIncreasingFlatSvg, label: 'Chart increasing' },
}

export function appIconFor(key: AppIconKey): IconAsset {
  return APP_ICONS[key]
}
