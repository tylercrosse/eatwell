// Minimal ambient types for the Google Identity Services script (loaded in index.html),
// covering only what LoginPage uses. See https://developers.google.com/identity/gsi/web.

interface GoogleIdCredentialResponse {
  credential: string // a Google ID token (JWT)
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleIdCredentialResponse) => void
  auto_select?: boolean
}

interface GoogleIdButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void
        renderButton: (parent: HTMLElement, options: GoogleIdButtonOptions) => void
        prompt: () => void
        disableAutoSelect: () => void
      }
    }
  }
}
