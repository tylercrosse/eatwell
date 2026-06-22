import type { CSSProperties } from 'react'
import { appIconFor, type AppIconKey } from '../lib/appIcons'

interface Props {
  name: AppIconKey
  size?: number
  className?: string
}

export function AppIcon({ name, size = 20, className = '' }: Props) {
  const icon = appIconFor(name)
  const classes = ['app-icon', `app-icon--${name}`, className].filter(Boolean).join(' ')
  return (
    <span
      className={classes}
      style={{ '--app-icon-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img className="app-icon__img" src={icon.src} alt="" width={size} height={size} draggable={false} />
    </span>
  )
}
