# ADR-0017: In-memory brute-force limiter: precise LRU + count-min sketch

- **Status:** Accepted (supersedes the eviction rules in ADR-0006)
- **Date:** 2026-11-25

## Context

The per-email login backoff (ADR-0006) kept every key in a bounded in-process map. Any
bounded map must decide what happens when it is full, and each option was found exploitable:

| Policy when full                                     | Failure mode                                                               | Classification                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| Evict oldest / least-recently-used                   | Attacker floods fresh keys, their own lockout is evicted, guessing resumes | Fail open: brute force         |
| Never evict active entries; refuse new keys          | Attacker fills the map with active lockouts, every other user gets 429     | Fail closed: denial of service |
| Evict the active entry with the least lock time left | Attacker floods, victim's (or their own) lockout is evicted early          | Fail open, narrower            |

The root cause is that the map is the only memory of a lockout. Rostra runs one API process
per host today and has no shared cache; a PostgreSQL-backed store is planned for multi-instance
deployments (RO-107).

## Decision Drivers

- An attacker must not be able to lift a lockout by exhausting memory (no fail open)
- An attacker must not be able to lock out unrelated users by exhausting memory (no fail closed)
- Constant, small memory; O(1) work per attempt; no new infrastructure
- Errors, if any, should only over-throttle the specific keys involved

## Considered Options

1. Larger map only (raises the bar, keeps both failure modes)
2. PostgreSQL counters now (correct, but adds a write per login and couples login latency to the database; scheduled as RO-107)
3. Precise bounded map plus a non-evictable count-min sketch as the source of truth for lockouts

## Decision

Option 3, narrowed so the sketch is only an overflow for evicted lockouts.

- **Precise layer (source of truth when present).** The bounded map keeps exact per-key state
  and is always consulted first. A precise entry wins over anything in the sketch, so a
  successful login (`reset`, failures 0) overrides sketch history for that key.
- **Sketch layer (written only on forced eviction).** When the full map must evict an entry that
  is still active (lockout running), the eviction hook records that entry's failure count and
  remaining deadline into a fixed `CountMinSketch` (4 rows x 16 384 slots, keyed by
  HMAC-SHA256(process secret, normalised email)). Ordinary failures never write to the sketch,
  so polluting it requires forcing evictions, which the per-source distinct-email cap and
  per-IP window throttle.
- **Read rule.** The sketch is read only for keys with no precise entry. Slots keep per-slot
  maxima and reads take the minimum across rows, so a collision can only over-estimate. Counts
  halve every `2 x LOGIN_EMAIL_BACKOFF_MAX_MS`; expired deadlines are cleared at the same time.
- **Saturation guard.** If any row is more than 50% occupied, sketch reads return nothing (this
  layer fails open), an error is logged and a counter incremented. The precise map, the per-IP
  window, the IP+email window and the distinct-email cap keep working.
- **Unchanged guards.** Attempts are reserved synchronously before the first await; the map
  admits every new key (expired or inactive entries go first, then the active entry with the
  least time remaining, which is handed to the sketch).

## Consequences

- Good: flooding cannot lift a lockout (evicted active entries move to the sketch) and cannot
  block unrelated users (the map always admits new keys, the sketch only holds evicted lockouts,
  and collisions affect only keys sharing all four slots). Memory and CPU per attempt are
  constant.
- Good: a successful login always clears the user's state, because the precise entry wins.
- Bad: estimates are upper bounds. With n locked keys in a window the chance that an unrelated
  key collides in all four rows is about (n / 16 384)^4, roughly 1.5e-5 even at n = 1 000;
  such a key is over-throttled until the colliding lockouts expire.
- Bad: state is per process and lost on restart; a restart therefore lifts lockouts. This and
  multi-instance consistency are resolved by the PostgreSQL store (RO-107), which must land
  before running more than one API instance.
- Residual risk accepted: an attacker with very many distinct sources can force enough
  evictions to saturate the sketch; it then fails open for evicted lockouts only (alerted and
  counted) while all other limiters stay in force. Further limiter findings are tracked against
  this record and RO-107 rather than by more in-process mechanisms.
