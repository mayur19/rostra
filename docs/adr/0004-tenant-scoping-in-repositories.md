# ADR-0004: Tenant scoping enforced in the repository layer

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Organizations (hospitals, stores) must never see each other's staff or rosters. Row-level security adds operational complexity for a single-role database connection.

## Decision Drivers

- No cross-tenant leakage
- Simple to review
- Works with one connection pool

## Considered Options

1. PostgreSQL row-level security with per-request settings
2. Schema per tenant
3. `organization_id` parameter on every repository function, taken from the session

## Decision

Every repository function takes `organizationId` from `request.auth` and includes it in the WHERE clause; child tables (shifts, assignments) are reached only through a tenant-checked parent (`requireRoster`). Ids from other tenants yield 404.

## Consequences

- Good: easy to audit with grep; integration tests assert cross-tenant 404s.
- Bad: a forgotten predicate is a bug class; mitigated by review and tests. RLS remains an option for defence in depth.
