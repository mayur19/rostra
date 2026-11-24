# ADR-0002: Fastify 5 with hand-written SQL over pg

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The API needs routing, cookies, structured logging and fast JSON. Data access is dominated by a few aggregate queries (employees with skills and unavailability, schedule views) and transactional writes with row locks.

## Decision Drivers

- Explicit control over SQL (locks, `unnest` bulk inserts, range types)
- Low dependency count
- Performance and first-class pino logging

## Considered Options

1. Express + ORM
2. Fastify 5 + `pg` with SQL in repository modules
3. NestJS + TypeORM

## Decision

Use Fastify 5 with `@fastify/cookie`, pino and `pg`. SQL lives in `*.repository.ts` files with parameterized queries only; zod validates all input in route handlers.

## Consequences

- Good: `SELECT ... FOR UPDATE`, `tstzrange` + GiST, and `json_agg` are used directly.
- Good: four runtime dependencies besides zod.
- Bad: no automatic schema-to-type mapping; row types are declared by hand and covered by integration tests.
