import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal } from './Modal'
import { createInviteLink } from '../api/invites'
import { ApiError } from '../api/client'
import type { MintedInviteLink } from '../types'

/**
 * Invite someone, from your phone, in the time it takes to say "here, scan this".
 *
 * Mints a single-use link and hands it to the OS share sheet — iMessage, AirDrop, Mail,
 * whatever they've got. Copy is the fallback, since `navigator.share` needs a secure context
 * and a user gesture, and doesn't exist on desktop Firefox at all.
 *
 * The URL comes back exactly once and can't be fetched again (only its hash is stored), so it
 * stays on screen until dismissed and the copy says so.
 */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mint = useMutation({
    mutationFn: createInviteLink,
    onMutate: () => setError(null),
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : "Couldn't create an invite. Please try again.",
      ),
  })

  const link: MintedInviteLink | undefined = mint.data

  async function share(url: string) {
    setError(null)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Calorie Tracker', text: 'Join me on Calorie Tracker', url })
        return
      } catch (e) {
        // A user dismissing the sheet throws AbortError — not a failure worth reporting.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    await copy(url)
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select the link above and copy it manually.')
    }
  }

  return (
    <Modal title="Invite someone" onClose={onClose}>
      <section className="settings__section">
        {!link ? (
          <>
            <p className="muted">
              Creates a single-use link, good for 7 days. They can sign in with Google or with
              their email — they don't need a Google account.
            </p>
            <label className="field">
              <span className="field__label">Who's it for? (optional)</span>
              <input
                type="text"
                value={note}
                placeholder="e.g. Sam from lunch"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="btn btn--primary invite__action"
              disabled={mint.isPending}
              onClick={() => mint.mutate({ note: note.trim() || undefined, max_uses: 1 })}
            >
              {mint.isPending ? 'Creating…' : 'Create invite link'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Share this now — for security it isn't stored, so you won't be able to see it
              again. Creating another is free.
            </p>
            <p className="invite__url">{link.url}</p>
            <div className="invite__actions">
              <button className="btn btn--primary" onClick={() => share(link.url)}>
                Share…
              </button>
              <button className="btn btn--ghost" onClick={() => copy(link.url)}>
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
            </div>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </section>
    </Modal>
  )
}
