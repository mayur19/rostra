# Backlog

Every unit of work for Rostra is tracked here. Ticket IDs (`RO-nnn`) are referenced from
pending API endpoints (`501 NOT_IMPLEMENTED` responses carry `details.ticket`), from
[requirements-traceability.md](../product/requirements-traceability.md) and from GitHub issues.

Estimates are engineering hours including tests and docs. `Status` is `done` or `pending`.
[implementation-status.md](implementation-status.md) derives the completion percentage from
this table (hours done / total hours).

## Epics

| Epic | Name                            | Summary                                                           |
| ---- | ------------------------------- | ----------------------------------------------------------------- |
| E0   | Foundation                      | Monorepo, config, logging, errors, migrations, CI, launcher       |
| E1   | Identity & access               | Organizations, users, sessions, CSRF, RBAC, audit                 |
| E2   | Workforce model                 | Locations, departments, positions, skills, employees, contracts   |
| E3   | Demand & coverage               | Shift templates, historical volumes, forecasting, coverage curves |
| E4   | Solver & rules                  | Constraint model, evaluators, solver, labor rules engine, jobs    |
| E5   | Schedule editing & publish      | Week grid, manual edits, live violations, publish, notifications  |
| E6   | Availability & time off         | Recurring availability, time-off requests and approvals           |
| E7   | Shift marketplace               | Open shifts, swap requests, eligibility checks, approvals         |
| E8   | Time & attendance               | Kiosk PIN punch, punch rules, timesheets, approvals               |
| E9   | Payroll, reporting & compliance | Labor cost, payroll CSV export, fairness and compliance reports   |
| E10  | Platform hardening              | Performance, accessibility, backups, observability, i18n          |

## Tickets

| ID     | Title                                                                         | Epic | Milestone | Est (h) | Status  | Depends on     |
| ------ | ----------------------------------------------------------------------------- | ---- | --------- | ------: | ------- | -------------- |
| RO-001 | Monorepo tooling: workspaces, strict TS, ESLint, Prettier, editorconfig       | E0   | M0        |       4 | done    | -              |
| RO-002 | Zod-validated config loader, pino logging, request IDs                        | E0   | M0        |       4 | done    | RO-001         |
| RO-003 | JSON envelope, central error handler, 501 stub helper                         | E0   | M0        |       3 | done    | RO-002         |
| RO-004 | Forward-only SQL migration runner with checksums                              | E0   | M0        |       4 | done    | RO-002         |
| RO-005 | Health and readiness endpoints                                                | E0   | M0        |       1 | done    | RO-003         |
| RO-006 | run.sh launcher (setup/migrate/seed/reset/test/dev)                           | E0   | M0        |       4 | done    | RO-004         |
| RO-007 | CI workflow on runner-native PostgreSQL (lint/format/typecheck/test/build)    | E0   | M0        |       3 | done    | RO-006         |
| RO-008 | Documentation set (PRD, requirements, ADRs, design, OpenAPI, runbooks)        | E0   | M0        |      12 | done    | -              |
| RO-010 | Organization owner registration with scrypt password hashing                  | E1   | M0        |       3 | done    | RO-004         |
| RO-011 | Login/logout/me with Postgres-backed HttpOnly session cookies                 | E1   | M0        |       4 | done    | RO-010         |
| RO-012 | CSRF double-submit token on mutating requests                                 | E1   | M0        |       2 | done    | RO-011         |
| RO-013 | Login rate limiting (per IP + email sliding window)                           | E1   | M0        |       2 | done    | RO-011         |
| RO-014 | RBAC skeleton (roles -> permissions, route guards)                            | E1   | M0        |       2 | done    | RO-011         |
| RO-015 | Audit log write path and read endpoint                                        | E1   | M0        |       2 | done    | RO-011         |
| RO-020 | Constraint model, DST-safe time helpers and shift template expansion          | E4   | M1        |       8 | done    | RO-001         |
| RO-021 | Hard/soft rule evaluators with explainable violations                         | E4   | M1        |       8 | done    | RO-020         |
| RO-022 | Greedy construction + simulated annealing solver, seeded and deterministic    | E4   | M1        |      12 | done    | RO-021         |
| RO-023 | Solver test suite and benchmark                                               | E4   | M1        |       5 | done    | RO-022         |
| RO-024 | Skills and employees API (list/create/get/update) with skill grants           | E2   | M1        |       5 | done    | RO-014         |
| RO-025 | Rosters and shift demand API                                                  | E4   | M1        |       4 | done    | RO-024         |
| RO-026 | Solve, schedule, evaluate and manual-assignment endpoints; solver run history | E4   | M1        |       6 | done    | RO-022, RO-025 |
| RO-027 | Web shell: login, layout, planned-section badges                              | E5   | M1        |       4 | done    | RO-011         |
| RO-028 | Week grid UI with assignments, violations panel and generate action           | E5   | M1        |       6 | done    | RO-026         |
| RO-029 | Demo seed: hospital ward with 20 staff and a week of demand                   | E0   | M1        |       2 | done    | RO-026         |
| RO-101 | Organization settings (name, default time zone, week start day)               | E1   | M2        |       9 | pending | RO-014         |
| RO-102 | Invite users by email via in-app outbox, accept invitation                    | E1   | M2        |      17 | pending | RO-101         |
| RO-103 | User role management and deactivation                                         | E1   | M2        |       9 | pending | RO-102         |
| RO-104 | Password reset with single-use tokens (outbox delivery)                       | E1   | M2        |      12 | pending | RO-102         |
| RO-105 | Session management: list/revoke sessions, idle and absolute timeouts          | E1   | M9        |       9 | pending | RO-011         |
| RO-106 | Email-verified signup via local outbox (uniform response, verification token) | E1   | M2        |      17 | pending | RO-102         |
| RO-110 | Locations CRUD with per-location time zone                                    | E2   | M2        |      12 | pending | RO-101         |
| RO-111 | Departments CRUD and department-scoped permissions                            | E2   | M2        |      14 | pending | RO-110         |
| RO-112 | Positions CRUD (position -> required skills, default rates)                   | E2   | M2        |      12 | pending | RO-111         |
| RO-113 | Contract entity: versioned contracts with effective dates                     | E2   | M2        |      20 | pending | RO-024         |
| RO-120 | Archive employees (soft delete) with history retention                        | E2   | M2        |       6 | pending | RO-024         |
| RO-121 | Employee CSV import with validation report                                    | E2   | M2        |      17 | pending | RO-024         |
| RO-122 | Certification expiry tracking and expiring-soon report                        | E2   | M2        |      12 | pending | RO-024         |
| RO-130 | Recurring weekly availability patterns with exceptions                        | E6   | M3        |      20 | pending | RO-113         |
| RO-131 | Time-off requests (create/list/cancel) with balance checks                    | E6   | M3        |      20 | pending | RO-130         |
| RO-132 | Time-off approval workflow with conflict preview against schedules            | E6   | M3        |      17 | pending | RO-131         |
| RO-133 | Feed approved time off and availability into solver unavailability            | E6   | M3        |       9 | pending | RO-132         |
| RO-140 | Demand forecasting: moving averages and weekday/hour seasonality in-house     | E3   | M4        |      35 | pending | RO-141         |
| RO-141 | Historical volume import (CSV) and storage per location/interval              | E3   | M4        |      14 | pending | RO-110         |
| RO-142 | Coverage requirements per 15-minute interval (workload -> headcount)          | E3   | M4        |      23 | pending | RO-140         |
| RO-143 | Generate shift demand from coverage curve (interval covering heuristic)       | E3   | M4        |      29 | pending | RO-142         |
| RO-150 | Shift templates CRUD                                                          | E3   | M4        |       9 | pending | RO-112         |
| RO-151 | Generate roster shifts from templates (DST-safe expansion)                    | E3   | M4        |       9 | pending | RO-150         |
| RO-160 | Asynchronous solver jobs: queue table, worker, progress, cancellation         | E4   | M5        |      29 | pending | RO-026         |
| RO-161 | Violation explanations and what-if (why can't X work Y?)                      | E4   | M5        |      23 | pending | RO-021         |
| RO-162 | Labor rules engine: jurisdiction rule sets (daily OT, breaks, minors, nights) | E4   | M5        |      46 | pending | RO-021         |
| RO-163 | Cross-week carry-over (rest and consecutive days spanning roster boundary)    | E4   | M5        |      14 | pending | RO-022         |
| RO-164 | Solver quality: tabu list, adaptive reheating, multi-start portfolio          | E4   | M5        |      35 | pending | RO-022         |
| RO-165 | Configurable constraint weights per organization                              | E4   | M5        |      12 | pending | RO-101         |
| RO-166 | Multi-skill split staffing and minimum-seniority-per-shift constraints        | E4   | M5        |      23 | pending | RO-162         |
| RO-170 | Publish roster (immutable published version, diff vs draft)                   | E5   | M5        |      20 | pending | RO-026         |
| RO-171 | In-app notifications with read state (publish, approvals, swaps)              | E5   | M5        |      17 | pending | RO-170         |
| RO-172 | Drag-and-drop manual editing with live violation feedback in the grid         | E5   | M5        |      29 | pending | RO-028         |
| RO-173 | Roster versioning and undo/redo of manual edits                               | E5   | M5        |      20 | pending | RO-172         |
| RO-174 | Optimistic concurrency on roster edits (version column, 409 on conflict)      | E5   | M5        |       9 | pending | RO-172         |
| RO-180 | Shift swap requests between employees                                         | E7   | M6        |      23 | pending | RO-170         |
| RO-181 | Swap eligibility check using the rule evaluators                              | E7   | M6        |      12 | pending | RO-180         |
| RO-182 | Manager approval of swaps and open-shift claims                               | E7   | M6        |      14 | pending | RO-181         |
| RO-183 | Open shift board (unfilled slots offered to eligible staff)                   | E7   | M6        |      20 | pending | RO-181         |
| RO-190 | Kiosk PIN punch in/out with clock-skew safe server timestamps                 | E8   | M7        |      20 | pending | RO-170         |
| RO-191 | Punch rules: rounding, early/late tolerance, missed punch exceptions          | E8   | M7        |      23 | pending | RO-190         |
| RO-192 | Kiosk device registration and PIN management                                  | E8   | M7        |      12 | pending | RO-190         |
| RO-200 | Timesheets from punches vs schedule with variance flags                       | E8   | M7        |      26 | pending | RO-191         |
| RO-201 | Timesheet approval and lock                                                   | E8   | M7        |      12 | pending | RO-200         |
| RO-210 | Payroll CSV export (regular/overtime/night differential lines)                | E9   | M8        |      20 | pending | RO-201         |
| RO-220 | Fairness report (hours, weekends, nights distribution over time)              | E9   | M8        |      17 | pending | RO-170         |
| RO-221 | Labor cost report (scheduled vs actual, by department)                        | E9   | M8        |      17 | pending | RO-200         |
| RO-222 | Compliance report (rest, max hours, minors) from labor rules engine           | E9   | M8        |      20 | pending | RO-162         |
| RO-230 | Employee self-service: my schedule, my requests                               | E5   | M6        |      17 | pending | RO-170         |
| RO-231 | iCalendar feed for personal schedules (signed URL)                            | E5   | M6        |       9 | pending | RO-230         |
| RO-240 | Accessibility pass (WCAG 2.2 AA) on grid and forms                            | E10  | M9        |      17 | pending | RO-172         |
| RO-241 | Solver performance: 500 staff x 4 weeks under 30 s; profiling and caching     | E10  | M9        |      29 | pending | RO-164         |
| RO-242 | Backup/restore drill automation and retention policy                          | E10  | M9        |       9 | pending | RO-007         |
| RO-243 | Metrics endpoint and dashboards (request latency, solver runs)                | E10  | M9        |      14 | pending | RO-160         |
| RO-244 | Internationalisation of UI strings and locale-aware formatting                | E10  | M9        |      17 | pending | RO-027         |
| RO-245 | Playwright end-to-end suite in CI with installed browsers                     | E10  | M9        |      12 | pending | RO-028         |
| RO-246 | Data retention and employee data export/erasure                               | E10  | M9        |      14 | pending | RO-120         |
| RO-107 | Shared Postgres-backed rate-limit counters for multi-instance deployments     | E10  | M9        |      12 | pending | RO-013         |

## Totals

| Status  | Tickets | Hours |
| ------- | ------: | ----: |
| done    |      24 |   110 |
| pending |      58 |  1014 |
| total   |      82 |  1124 |
