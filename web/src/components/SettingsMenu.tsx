import { Modal } from './Modal'
import { DARK_THEMES, THEMES, THEME_BG, useTheme, type ThemeId } from '../lib/theme'
import { TEXT_SIZES } from '../lib/textSize'
import { CHART_PALETTES } from '../lib/colors'

/** Mini preview swatch for a theme (null = the "System" option, rendered as a light/dark split). */
function swatchColors(id: ThemeId): { bg: string; surface: string; accent: string } | null {
  if (id === 'system') return null
  const p = CHART_PALETTES[id]
  return { bg: THEME_BG[id], surface: p.surface, accent: p.accent }
}

function ThemeOption({
  id,
  label,
  active,
  onSelect,
}: {
  id: ThemeId
  label: string
  active: boolean
  onSelect: () => void
}) {
  const sw = swatchColors(id)
  return (
    <button
      type="button"
      className={`theme-option ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span
        className={`theme-swatch ${sw ? '' : 'theme-swatch--system'}`}
        style={sw ? { background: sw.bg } : undefined}
        aria-hidden
      >
        {sw && (
          <>
            <span className="theme-swatch__bar" style={{ background: sw.surface }} />
            <span className="theme-swatch__dot" style={{ background: sw.accent }} />
          </>
        )}
      </span>
      <span className="theme-option__label">{label}</span>
      {active && (
        <span className="theme-option__check" aria-hidden>
          ✓
        </span>
      )}
    </button>
  )
}

/** App settings sheet. Theme is the first occupant; future prefs (units, default meal, …) land here. */
export function SettingsMenu({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, systemDark, setSystemDark, textSize, setTextSize } = useTheme()
  return (
    <Modal title="Settings" onClose={onClose}>
      <section className="settings__section">
        <h3 className="settings__heading">Theme</h3>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <ThemeOption
              key={t.id}
              id={t.id}
              label={t.label}
              active={theme === t.id}
              onSelect={() => setTheme(t.id)}
            />
          ))}
        </div>
      </section>

      {theme === 'system' && (
        <section className="settings__section">
          <h3 className="settings__heading">Dark variant for System</h3>
          <div className="theme-grid">
            {DARK_THEMES.map((t) => (
              <ThemeOption
                key={t.id}
                id={t.id}
                label={t.label}
                active={systemDark === t.id}
                onSelect={() => setSystemDark(t.id)}
              />
            ))}
          </div>
          <p className="settings__hint">Used when your device is in dark mode.</p>
        </section>
      )}

      <section className="settings__section">
        <h3 className="settings__heading">Text size</h3>
        <div className="size-grid">
          {TEXT_SIZES.map((s) => {
            const active = textSize === s.id
            return (
              <button
                key={s.id}
                type="button"
                className={`size-option ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => setTextSize(s.id)}
              >
                <span className={`size-option__preview size-option__preview--${s.id}`} aria-hidden>
                  A
                </span>
                <span className="size-option__label">{s.label}</span>
              </button>
            )
          })}
        </div>
        <p className="settings__hint">Scales all text in the app. Affects this device only.</p>
      </section>
    </Modal>
  )
}
