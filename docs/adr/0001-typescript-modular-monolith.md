# ADR-0001: TypeScript modular monolith in npm workspaces

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Rostra needs a web UI, an HTTP API and a non-trivial scheduling engine. The engine must be shared between server (solve, validate edits) and, later, browser (instant drag-and-drop feedback). A single small team maintains it and customers self-host on one VM.

## Decision Drivers

- One language across UI, API and solver
- Shared, unit-testable domain code
- Simple deployment (one process + PostgreSQL)
- Strict typing for a rule-heavy domain

## Considered Options

1. Microservices (API, solver service, UI)
2. Monolith with TypeScript in npm workspaces (`packages/shared`, `apps/api`, `apps/web`)
3. Python backend + TypeScript UI

## Decision

Use a TypeScript (strict, `noUncheckedIndexedAccess`) modular monolith in npm workspaces. Domain logic lives in `packages/shared` and has no I/O; `apps/api` and `apps/web` depend on it.

## Consequences

- Good: the evaluator that explains violations in the API can run unchanged in the browser.
- Good: one build, one CI pipeline, one deployable.
- Bad: a CPU-heavy solve shares the API event loop until background jobs exist (see ADR-0014).
- Neutral: module boundaries are enforced by convention and review, not by process isolation.
