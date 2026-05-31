// Single place that touches import.meta.env. Backend base URL is swappable per build.
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api'
