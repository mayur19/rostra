# ADR-0003: Server-side sessions with scrypt and double-submit CSRF

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Rostra is a browser application holding staff personal data. Tokens in localStorage are exposed to XSS; JWTs cannot be revoked without extra state. No external identity provider may be used.

## Decision Drivers

- Revocable sessions
- No secrets readable by scripts
- CSRF protection for cookie auth
- Only node:crypto, no native addons

## Considered Options

1. JWT in localStorage
2. Stateless signed cookies
3. Opaque session token in an HttpOnly cookie, stored hashed in PostgreSQL, plus CSRF double submit

## Decision

Opaque 32-byte tokens in an HttpOnly, SameSite=Lax `rostra_session` cookie; the database stores only `HMAC-SHA256(SESSION_SECRET, token)`. Passwords use scrypt (N=16384, r=8, p=1, 16-byte salt) with parameters encoded in the hash. Mutating requests must send `x-csrf-token` equal to the readable `rostra_csrf` cookie and, when signed in, to the session's stored token.

## Consequences

- Good: logout and deactivation revoke immediately.
- Good: a database leak cannot be replayed as cookies.
- Bad: one indexed lookup per request (cheap).
- Neutral: idle/absolute timeouts and session listing are pending (RO-105).
