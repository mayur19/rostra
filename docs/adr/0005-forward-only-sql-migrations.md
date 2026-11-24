# ADR-0005: Forward-only plain-SQL migrations with checksums

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The schema must evolve safely on customer-run servers without a migration framework dependency.

## Decision Drivers

- Reviewable SQL
- Safe re-runs
- Detect edited history

## Considered Options

1. ORM migrations
2. Third-party migration tool
3. Small in-repo runner over `migrations/NNNN_name.sql`

## Decision

`apps/api/src/db/migrate.ts` applies files in lexical order, each in its own transaction, recording name and SHA-256 checksum in `schema_migrations`. A changed checksum aborts startup. There are no down migrations; fixes are new forward migrations; rollback is restore from backup (see deployment.md).

## Consequences

- Good: ~80 lines, no dependency, transactional DDL in PostgreSQL.
- Bad: no automatic down migration; releases must be backward compatible for one version.
