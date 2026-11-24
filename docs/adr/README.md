# Architecture decision records

Decisions use the MADR format (Context, Decision Drivers, Considered Options, Decision, Consequences, Status). Records are immutable once accepted; a change of mind is a new ADR that supersedes the old one.

| ADR                                                           | Title                                                                      | Status   | Kind     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- | -------- |
| [0001](0001-typescript-modular-monolith.md)                   | TypeScript modular monolith in npm workspaces                              | Accepted | platform |
| [0002](0002-fastify-and-plain-sql.md)                         | Fastify 5 with hand-written SQL over pg                                    | Accepted | platform |
| [0003](0003-session-auth-and-csrf.md)                         | Server-side sessions with scrypt and double-submit CSRF                    | Accepted | platform |
| [0004](0004-tenant-scoping-in-repositories.md)                | Tenant scoping enforced in the repository layer                            | Accepted | platform |
| [0005](0005-forward-only-sql-migrations.md)                   | Forward-only plain-SQL migrations with checksums                           | Accepted | platform |
| [0006](0006-in-process-login-rate-limiting.md)                | In-process login and registration throttling                               | Accepted | platform |
| [0007](0007-incremental-search-state.md)                      | Incremental scoring with one mutable SearchState                           | Accepted | domain   |
| [0008](0008-in-house-solver.md)                               | Build the constraint solver in-house                                       | Accepted | domain   |
| [0009](0009-greedy-construction-plus-annealing.md)            | Most-constrained-first greedy construction followed by simulated annealing | Accepted | domain   |
| [0010](0010-seeded-determinism-iteration-budget.md)           | Seeded PRNG and iteration budget for reproducible solves                   | Accepted | domain   |
| [0011](0011-lexicographic-hard-soft-score.md)                 | Lexicographic hard/soft score collapsed with HARD_MULTIPLIER               | Accepted | domain   |
| [0012](0012-utc-instants-and-intl-time-zones.md)              | UTC instants and Intl-only, DST-safe time-zone handling                    | Accepted | domain   |
| [0013](0013-explainable-violations.md)                        | Explainable violations produced by the evaluators themselves               | Accepted | domain   |
| [0014](0014-synchronous-solve-under-row-lock.md)              | Synchronous solve inside a transaction holding the roster row lock         | Accepted | domain   |
| [0015](0015-contract-embedded-in-employee.md)                 | Contract terms embedded in the employees table for the first slice         | Accepted | domain   |
| [0016](0016-fairness-as-utilization-variance.md)              | Fairness measured as variance of utilization                               | Accepted | domain   |
| [0017](0017-brute-force-limiter-lru-plus-count-min-sketch.md) | In-memory brute-force limiter: precise LRU + count-min sketch              | Accepted | security |

Ten of the seventeen records are domain-specific decisions about the scheduling model and solver.
