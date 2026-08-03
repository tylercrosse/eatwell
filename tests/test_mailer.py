"""Mailer dispatch and the SMTP transport. No network: smtplib.SMTP is monkeypatched."""

from __future__ import annotations

import smtplib

import pytest

from app import mailer
from app.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(**overrides)


class _FakeSMTP:
    """Records what a real send would have done. Doubles as the context manager smtplib gives."""

    instances: list[_FakeSMTP] = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.started_tls = False
        self.login_args: tuple[str, str] | None = None
        self.messages: list[object] = []
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.started_tls = True

    def login(self, user, password):
        self.login_args = (user, password)

    def send_message(self, message):
        self.messages.append(message)


@pytest.fixture(autouse=True)
def _reset_fake():
    _FakeSMTP.instances = []
    yield


def test_console_provider_prints_and_does_not_raise(capsys):
    mailer.send_email(
        to="friend@example.com", subject="Hi", text="body", settings=_settings()
    )
    out = capsys.readouterr().out
    assert "friend@example.com" in out
    assert "body" in out


def test_unknown_provider_is_a_configuration_error():
    with pytest.raises(mailer.EmailNotConfigured):
        mailer.send_email(
            to="a@b.com", subject="s", text="t", settings=_settings(email_provider="carrier-pigeon")
        )


def test_smtp_without_a_host_is_a_configuration_error():
    with pytest.raises(mailer.EmailNotConfigured):
        mailer.send_email(
            to="a@b.com", subject="s", text="t", settings=_settings(email_provider="smtp")
        )


def test_smtp_without_a_sender_is_a_configuration_error():
    with pytest.raises(mailer.EmailNotConfigured):
        mailer.send_email(
            to="a@b.com",
            subject="s",
            text="t",
            settings=_settings(email_provider="smtp", smtp_host="smtp.example.com"),
        )


def test_smtp_sends_via_the_configured_host(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    mailer.send_email(
        to="friend@example.com",
        subject="Sign in",
        text="link",
        settings=_settings(
            email_provider="smtp",
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="me@gmail.com",
            smtp_password="app-password",
            email_from="me@gmail.com",
        ),
    )

    sent = _FakeSMTP.instances[-1]
    assert (sent.host, sent.port) == ("smtp.gmail.com", 587)
    assert sent.started_tls is True
    assert sent.login_args == ("me@gmail.com", "app-password")
    assert len(sent.messages) == 1

    message = sent.messages[0]
    assert message["To"] == "friend@example.com"
    assert "me@gmail.com" in message["From"]
    assert message["Subject"] == "Sign in"


def test_smtp_transport_failure_becomes_an_email_error(monkeypatch):
    class _Boom(_FakeSMTP):
        def send_message(self, message):
            raise smtplib.SMTPException("upstream refused")

    monkeypatch.setattr(smtplib, "SMTP", _Boom)
    with pytest.raises(mailer.EmailError) as exc:
        mailer.send_email(
            to="a@b.com",
            subject="s",
            text="t",
            settings=_settings(
                email_provider="smtp", smtp_host="smtp.example.com", email_from="me@example.com"
            ),
        )
    # Not EmailNotConfigured: transport failures must stay generic at the route boundary.
    assert not isinstance(exc.value, mailer.EmailNotConfigured)
