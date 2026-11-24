# Product requirements document: Rostra

## 1. Vision

Every shift-based organization should be able to publish a fair, legal, fully staffed
roster in minutes instead of days, and understand exactly why any rule was bent.
Rostra does this with a transparent, in-house constraint solver that runs entirely on the
customer's own infrastructure with no external services.

## 2. Problem

Schedulers in hospitals, retail chains and contact centers still build rosters in
spreadsheets. A typical 40-bed ward roster (20-40 staff, three shifts a day, several skills)
takes a charge nurse 6-10 hours a week and still contains errors:

- **Coverage gaps**: a night shift without a qualified RN is found only on the day.
- **Labor-law breaches**: fewer than 11 hours between an evening and the next morning,
  more than five consecutive days, lapsed certifications.
- **Unfairness**: the same people repeatedly get weekends and nights; part-timers miss their
  contracted hours while others accrue overtime.
- **Opacity**: when a manager asks "why is Ava working Sunday?", nobody can answer.
- **Data sovereignty**: health and public-sector buyers cannot send staff data to hosted
  optimizers or third-party APIs.

## 3. Personas

| Persona                                | Role                                                    | Needs                                                                                  |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Sasha, scheduler / charge nurse**    | Builds the weekly roster for a ward                     | Generate a good draft fast, tweak it by hand, see violations live, lock manual choices |
| **Malik, unit manager**                | Approves rosters, time off and swaps; owns labor budget | Cost and overtime visibility, compliance assurance, fairness evidence                  |
| **Ava, employee (RN)**                 | Works shifts                                            | See her schedule, request time off, swap shifts, trust that rules are respected        |
| **Olivia, organization owner / admin** | Configures the tenant                                   | Users and roles, locations, departments, skills, rule sets, audit trail                |
| **Payroll officer**                    | Pays staff                                              | Approved timesheets and a payroll export with regular/overtime/night lines             |

## 4. Goals and non-goals

### Goals

1. Produce a weekly roster satisfying all hard rules whenever a feasible roster exists, and
   minimize soft penalties (preferences, overtime, fairness) otherwise.
2. Explain every violation in plain language tied to employees and shifts.
3. Deterministic, reproducible schedules: the same inputs and seed always yield the same roster.
4. Correct across time zones and DST transitions (a 22:00-06:00 night on a DST night is 7 or 9 real hours).
5. Self-hostable on a single VM with native PostgreSQL, no external calls at runtime.
6. Full lifecycle later: availability, time off, forecasting, publish, swaps, time clock, timesheets, payroll export, compliance reports.

### Non-goals

- Payroll calculation (taxes, deductions) - Rostra exports hours, it does not pay people.
- Hosted multi-region SaaS operations or third-party integrations (SSO providers, SMS, email gateways); notifications are in-app and email is an outbox table.
- Mathematical optimality proofs; the solver is a heuristic tuned for good solutions quickly.
- Native mobile apps (responsive web only).

## 5. Scope

| Area                    | In scope (target)                                                                     | Implemented now                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Identity & access       | Org registration, users, roles, sessions, CSRF, rate limits, audit                    | Registration, login/logout/me, CSRF, rate limiting, RBAC skeleton, audit write + read                 |
| Workforce model         | Locations, departments, positions, skills with expiry, employees, versioned contracts | Skills, employees with embedded contract terms, skill grants with expiry, unavailability periods      |
| Demand                  | Shift templates, historical volumes, forecasting, coverage curves, shift generation   | Template expansion in the domain package; manual shift demand per roster                              |
| Solver & rules          | Hard/soft rules, greedy + annealing, labor rule sets, async jobs, explanations        | 14 rules, greedy + simulated annealing, synchronous solve, explainable violations, solver run history |
| Schedule editing        | Week grid, drag-and-drop, live violations, pins, versions, publish                    | Week grid, evaluate-proposal endpoint, replace assignments with pins                                  |
| Availability & time off | Patterns, requests, approval workflow                                                 | Not yet (pending)                                                                                     |
| Marketplace             | Open shifts, swaps, approvals                                                         | Not yet (pending)                                                                                     |
| Time & attendance       | Kiosk PIN punch, timesheets                                                           | Not yet (pending)                                                                                     |
| Payroll & reporting     | Payroll CSV, fairness, cost, compliance reports                                       | Not yet (pending)                                                                                     |

## 6. Success metrics

| Metric                                                | Target                                              |
| ----------------------------------------------------- | --------------------------------------------------- |
| Time to produce a publishable weekly ward roster      | < 15 minutes (from 6-10 hours)                      |
| Hard-rule violations in published rosters             | 0 when a feasible roster exists                     |
| Solve time, 160 staff / 544 slots / 50k iterations    | < 5 s on a 2 vCPU VM (currently ~0.2-0.4 s locally) |
| Contracted-minimum attainment                         | >= 95% of employees within 4 h of their minimum     |
| Utilization standard deviation across full-time staff | < 0.15                                              |
| Scheduler satisfaction (survey)                       | >= 4.2 / 5 after first month                        |

## 7. Release plan

| Release                       | Milestones | Content                                                                                 |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| 0.1 Foundation + solver slice | M0, M1     | Current repository state                                                                |
| 0.2 Workforce                 | M2         | Org settings, users, locations, departments, positions, contracts, import               |
| 0.3 Availability              | M3         | Availability patterns, time-off requests and approval feeding the solver                |
| 0.4 Demand                    | M4         | Templates, historical volumes, forecasting, coverage-driven shift generation            |
| 0.5 Scheduling pro            | M5         | Async solver jobs, labor rule sets, explanations, publish, notifications, drag-and-drop |
| 0.6 Marketplace               | M6         | Swaps, open shifts, employee self-service, iCalendar                                    |
| 0.7 Attendance                | M7         | Kiosk punches, punch rules, timesheets                                                  |
| 0.8 Payroll & compliance      | M8         | Payroll CSV export, fairness/cost/compliance reports                                    |
| 1.0 GA                        | M9         | Accessibility, performance at 500 staff x 4 weeks, backups, metrics, i18n               |

## 8. Assumptions and constraints

- TypeScript on Node.js 22+, React, PostgreSQL 15+; no third-party APIs at runtime.
- One roster covers seven local days starting at `weekStart` in one IANA time zone.
- Money is integer minor units; instants are stored as `timestamptz` in UTC.
