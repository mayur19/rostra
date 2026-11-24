# Contributing

## Setup

```bash
./run.sh setup     # Node 22+, local PostgreSQL, creates .env and the databases
./run.sh test
```

## Workflow

1. Pick a ticket from [docs/planning/backlog.md](docs/planning/backlog.md) (or its GitHub issue).
2. Write the failing test first: domain rules in `packages/shared/test`, API behaviour in
   `apps/api/test` (real PostgreSQL), UI in `apps/web/test`.
3. Implement. Keep domain logic pure and immutable; the only sanctioned mutable structure is the
   solver's `SearchState` (ADR-0007). Files under 400 lines, functions small.
4. When a pending endpoint becomes real, remove it from
   `apps/api/src/modules/pending/pending.routes.ts`, flip `x-status` in `docs/api/openapi.yaml`,
   mark the ticket `done` in the backlog and update
   [implementation-status.md](docs/planning/implementation-status.md).
5. Schema changes: add a new `apps/api/migrations/NNNN_name.sql`; never edit applied migrations;
   update [data-model.md](docs/design/data-model.md).
6. Significant decisions get an ADR in `docs/adr/` (MADR format).

## Checks (CI runs the same)

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

## Commits

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `perf:`.
Reference ticket ids in the body (for example `Refs RO-170`).
