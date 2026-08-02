"""Outbound email.

One public function, :func:`send_email`, dispatching on ``EMAIL_PROVIDER``. Routes never learn
which transport is live, so adding an HTTP provider later — Resend or Postmark, once ct-cr.5
settles a sending domain — is a new branch here plus an env var, with no route changes.

``console`` prints instead of sending. That's the dev affordance that makes the whole sign-in
flow exercisable without a mailbox, and it's the default: a half-configured deploy then fails
visibly at send time instead of silently dropping mail. Returning the link in the HTTP response
would be easier to test but was rejected — a misconfigured production deploy would hand out
live sign-in tokens over the wire.

Why SMTP rather than an HTTP API for the first real provider: sending as ``@gmail.com`` through
Google's own servers is DKIM-signed by Google and DMARC-aligned, so it reaches inboxes. An HTTP
provider needs a verified sending domain, and there isn't one yet (ct-cr.5). ``EMAIL_FROM`` must
equal ``SMTP_USER`` or Google rewrites the sender and that alignment breaks.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.config import Settings

_TIMEOUT = 15.0  # seconds; matches the other integrations in this package


class EmailError(RuntimeError):
    """The message couldn't be sent. Routers surface this as a 502."""


class EmailNotConfigured(EmailError):
    """The provider is missing required settings — a deploy mistake, not a transport failure.

    Split out so routers can return the (safe, no user content) message for setup problems
    while keeping transport errors generic, since those can echo back server detail on an
    endpoint that doesn't require authentication.
    """


def send_email(*, to: str, subject: str, text: str, settings: Settings) -> None:
    """Send one plain-text message, or raise :class:`EmailError`."""
    provider = (settings.email_provider or "console").strip().lower()
    if provider == "console":
        _send_console(to=to, subject=subject, text=text)
        return
    if provider == "smtp":
        _send_smtp(to=to, subject=subject, text=text, settings=settings)
        return
    raise EmailNotConfigured(f"Unknown EMAIL_PROVIDER {provider!r}. Expected 'console' or 'smtp'.")


def _send_console(*, to: str, subject: str, text: str) -> None:
    """Print the message. The one deliberate stdout write in ``app/`` — see the module docstring."""
    print(f"\n[mail] to={to}\n[mail] subject={subject}\n{text}\n", flush=True)


def _build_message(*, to: str, subject: str, text: str, settings: Settings) -> EmailMessage:
    sender = settings.email_from or settings.smtp_user
    if not sender:
        raise EmailNotConfigured("EMAIL_FROM is not configured.")
    message = EmailMessage()
    message["To"] = to
    message["From"] = f"{settings.email_from_name} <{sender}>" if settings.email_from_name else sender
    message["Subject"] = subject
    message.set_content(text)
    return message


def _send_smtp(*, to: str, subject: str, text: str, settings: Settings) -> None:
    if not settings.smtp_host:
        raise EmailNotConfigured("SMTP_HOST is not configured.")
    message = _build_message(to=to, subject=subject, text=text, settings=settings)

    # Blocking, deliberately. The route is a sync `def` (it needs a Session), so FastAPI runs it
    # in a threadpool worker — this never blocks the event loop.
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_TIMEOUT) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailError(f"SMTP send failed: {exc}") from exc
