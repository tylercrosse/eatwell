// Single place that touches import.meta.env. Backend base URL is swappable per build.
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

// Google OAuth client id for Google Identity Services. Empty -> sign-in is unavailable.
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
