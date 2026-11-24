# ADR-0006: In-process login and registration throttling

- **Status:** Accepted; store eviction rules superseded by [ADR-0017](0017-brute-force-limiter-lru-plus-count-min-sketch.md)
- **Date:** 2026-11-24

## Context

Login and registration are the main brute-force targets. The current deployment model is one API process per host. Throttling must not depend on external services.

## Decision Drivers

- Stop credential stuffing and password spraying
- Limit targeted lockout of a victim
- No new infrastructure today
- Bounded memory

## Considered Options

1. No throttling, rely on nginx `limit_req`
2. Shared PostgreSQL counters now
3. In-process limiters with a key cap, moving to PostgreSQL before scaling out

## Decision

Use three in-process limiters on login: per IP+email fixed window (`LOGIN_RATE_LIMIT_MAX`=10 per `LOGIN_RATE_LIMIT_WINDOW_MS`=15 min), per IP fixed window against spraying (`LOGIN_IP_RATE_LIMIT_MAX`=50 per window), and per email progressive backoff (`LOGIN_EMAIL_FREE_ATTEMPTS`=5 free failures, then a lockout starting at `LOGIN_EMAIL_BACKOFF_BASE_MS`=30 s doubling per further failure, capped at `LOGIN_EMAIL_BACKOFF_MAX_MS`=1 h, reset on success). Registration is limited per IP (`REGISTER_RATE_LIMIT_MAX`=5 per `REGISTER_RATE_LIMIT_WINDOW_MS`=1 h). Client IPs come from `TRUST_PROXY`-validated proxies only. Counters move to a shared PostgreSQL store (RO-107) before more than one API instance runs.

Implementation rules that keep the limiters sound:

- **Atomic reservation.** Every limiter call is synchronous and happens before the first `await` in the login handler. The per-email limiter records each permitted attempt as a failure up front (pessimistic reservation) and a successful login resets it, so a burst of concurrent requests for one email is counted in full instead of racing past a check that has not yet seen them.
- **Key normalisation.** Limiter keys use the client address after IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is reduced to IPv4 and any other IPv6 address is collapsed to its /64 prefix, because one subscriber usually controls a whole /64.
- **Bounded memory without lockout-by-flooding.** Each limiter store has a hard cap (`LIMITER_MAX_KEYS`, default 50 000). A resumable sweep cursor walks the whole map over successive writes and removes expired entries. When a new key arrives at the cap, the store first frees an expired or inactive entry; only when every sampled entry is actively restricting does it evict the active entry with the least lock time remaining, logging a warning with a running counter. New keys are never refused, so an attacker who fills the store cannot lock out every other user. Evicting an active per-email entry does not lift the lockout, because a non-evictable count-min sketch remembers it ([ADR-0017](0017-brute-force-limiter-lru-plus-count-min-sketch.md)).
- **Per-source key budget.** One normalised address (IPv4, or IPv6 /64) may try at most `LOGIN_IP_DISTINCT_EMAILS_MAX` (default 20) distinct emails per window, so a single source cannot flood the per-email store; the per-IP attempt window still applies on top.
- **Proxy trust.** `TRUST_PROXY` is `false`, a hop count or a list of proxy IPs/CIDRs; `true` is rejected, and production startup fails when it is unset.

## Consequences

- Good: zero infrastructure, amortised O(1) per attempt, hard memory bound.
- Trade-off: an attacker controlling many distinct sources can still saturate a store with active lockouts; the store then evicts the lockouts closest to expiry, which can shorten some lockouts but never denies service to unrelated users. The shared PostgreSQL store (RO-107) removes the per-process cap.
- Bad: counters reset on restart and are per process; acceptable for single-instance deployments only.
- Trade-off: per-email backoff lets an attacker delay a victim's login; the 1 h cap bounds that targeted lockout.
