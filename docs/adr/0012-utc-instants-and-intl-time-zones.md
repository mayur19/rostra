# ADR-0012: UTC instants and Intl-only, DST-safe time-zone handling

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Hospitals run nights across DST changes; a 22:00-06:00 night is 7 or 9 real hours. Bundling a tz database adds weight and update burden; user-supplied zone strings could also grow caches.

## Decision Drivers

- Correct durations and local days across DST
- No tz data dependency
- Bounded memory under hostile input

## Considered Options

1. Store local times
2. Use a third-party tz library
3. UTC instants in `timestamptz` + `Intl.DateTimeFormat` for conversions

## Decision

Store all instants as UTC. Convert with `Intl.DateTimeFormat` (hourCycle h23): `zonedToUtc` resolves nonexistent spring-forward times forward by the gap and ambiguous fall-back times to the earlier instant. Templates resolve start and end from wall time independently. Formatters are cached only under the canonical IANA name from `resolvedOptions().timeZone`; the zod `timeZoneSchema` and `compileProblem` normalise zones (e.g. `america/new_york` -> `America/New_York`), so the cache is bounded by the number of real zones.

## Consequences

- Good: DST cases are unit tested; no dependency.
- Good: alternate spellings cannot grow memory.
- Bad: depends on the runtime's ICU data being current (Node ships full ICU).
