# ADR-0014: Synchronous solve inside a transaction holding the roster row lock

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Solving a ward takes ~0.1 s; a large site may take seconds. Two schedulers may solve or edit the same roster concurrently. A job queue adds a worker process and polling UI.

## Decision Drivers

- No lost or interleaved assignment writes
- Simple first slice
- Bounded latency

## Considered Options

1. Optimistic concurrency only
2. Background job queue now
3. Synchronous solve under `SELECT ... FOR UPDATE` on the roster row

## Decision

`POST /rosters/{id}/solve` opens a transaction, locks the roster row, loads data, runs `solve`, replaces non-pinned assignments, records `solver_runs`, bumps `version` and writes audit, then commits. Edits and shift changes take the same lock. Iterations are capped by `SOLVER_MAX_ITERATIONS`.

## Consequences

- Good: concurrent solves serialize; readers are never blocked (MVCC).
- Bad: the solve occupies the event loop and a pool connection; acceptable for wards, replaced by asynchronous `solver_jobs` with a worker (RO-160) for large sites.
