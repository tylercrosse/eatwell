// View detail level: Detailed surfaces macros and per-food nutrition; Simple hides them for a
// lighter, calorie-first read. Stored as a boolean (`simple`) so the original 'simple-view'
// localStorage values stay valid. Shared app-wide via the display-prefs context, so the Settings
// toggle drives both the Log and Guide pages at once.

export const SIMPLE_VIEW_STORAGE_KEY = 'simple-view'
export const DEFAULT_SIMPLE_VIEW = false // false = Detailed
