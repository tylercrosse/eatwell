import { CalorieValue } from './CalorieValue'
import { FoodIcon } from './FoodIcon'
import { MacroBar } from './MacroBar'
import { NutritionLegend } from './NutritionLegend'
import {
  choiceConfidenceCopy,
  foodChoiceLocationMeta,
  foodChoiceSectionLabel,
  type ScoredFoodChoice,
} from '../lib/choiceScan'
import { isBeverageForFullness } from '../lib/fullness'
import { StayingPowerBadge } from './StayingPowerBadge'

const CONF_CLASS = {
  high: 'conf--high',
  medium: 'conf--med',
  low: 'conf--low',
} as const

function choiceServingMeta(choice: ScoredFoodChoice['choice']): string {
  return choice.servingSize?.trim() || 'estimated serving'
}

interface Props {
  items: ScoredFoodChoice[]
  emptyText?: string
  simple?: boolean
}

export function ChoiceScanResults({ items, emptyText = 'No comparable options found.', simple = false }: Props) {
  if (items.length === 0) return <p className="empty choice-results__empty">{emptyText}</p>

  return (
    <div className="choice-results">
      {items.map((item, index) => {
        const { choice, reason } = item
        const confidence = choiceConfidenceCopy(choice.confidence)
        const showConfidence = confidence && confidence.tone !== 'high'
        const section = foodChoiceSectionLabel(choice)
        const location = foodChoiceLocationMeta(choice)
        return (
          <div className={`choice-row${simple ? ' choice-row--simple' : ' choice-row--detailed'}`} key={choice.id}>
            <span className="choice-row__rank">{index + 1}</span>
            <FoodIcon entry={{ food_name: choice.name, is_beverage: choice.is_beverage }} />
            <div className="choice-row__main">
              <div className="choice-row__top">
                <span className="choice-row__name">{choice.name}</span>
                <StayingPowerBadge power={item.stayingPower} variant="compact" explain />
                {section && <span className="choice-row__section">{section}</span>}
                {isBeverageForFullness(choice) && <span className="guide-tag guide-tag--warn">Drink</span>}
              </div>
              {location && <span className="choice-row__details">{location}</span>}
              {choice.description && <p className="choice-row__desc">{choice.description}</p>}
              <span className="choice-row__meta">{choiceServingMeta(choice)}</span>
              {!simple && (
                <>
                  <MacroBar protein_g={choice.protein_g} carbs_g={choice.carbs_g} fat_g={choice.fat_g} />
                  <NutritionLegend food={choice} />
                </>
              )}
              <p className="choice-row__why">{reason}</p>
              {!simple && choice.sourceText && <span className="choice-row__source">Menu text: {choice.sourceText}</span>}
            </div>
            <CalorieValue calories={choice.calories} className="choice-row__right">
              {showConfidence && (
                <span className={`conf choice-row__conf ${CONF_CLASS[confidence.tone]}`}>{confidence.label}</span>
              )}
            </CalorieValue>
          </div>
        )
      })}
    </div>
  )
}
