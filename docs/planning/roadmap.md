# Roadmap

Milestones are sequential by dependency, not by calendar. Hours come from
[backlog.md](backlog.md); exit criteria are what must be demonstrably true to close a milestone.

| Milestone | Theme                                | Hours | Status  |
| --------- | ------------------------------------ | ----: | ------- |
| M0        | Foundation                           |    50 | done    |
| M1        | First slice: constraint solver       |    60 | done    |
| M2        | Workforce model and identity         |   157 | planned |
| M3        | Availability and time off            |    66 | planned |
| M4        | Demand forecasting and coverage      |   119 | planned |
| M5        | Solver depth, editing and publishing |   277 | planned |
| M6        | Shift marketplace and self-service   |    95 | planned |
| M7        | Time and attendance                  |    93 | planned |
| M8        | Payroll, reporting and compliance    |    74 | planned |
| M9        | Hardening and general availability   |   133 | planned |

## M0 Foundation (done)

Tickets: RO-001..RO-008, RO-010..RO-015.

Exit criteria: `./run.sh setup` works on a fresh clone against local PostgreSQL; CI runs lint,
format, typecheck, tests and build on the runner's PostgreSQL; register/login/logout/me work
with CSRF and throttling; every mutation writes an audit row.

## M1 First slice: constraint solver (done)

Tickets: RO-020..RO-029.

Exit criteria: the solver produces a feasible, fully covered roster for the demo ward in under
one second; identical seed and iteration budget give identical output; every violation is
explained in plain language; a 160-person, 544-slot week solves under 5 s in the test suite;
schedulers can generate and inspect a week in the web grid.

## M2 Workforce model and identity

Tickets: RO-101..RO-107 (RO-105, RO-107 land in M9), RO-110..RO-113, RO-120..RO-122.

Exit criteria: organizations manage locations (each with its own time zone), departments and
positions; users are invited through the in-app outbox and sign-up is email-verified (RO-106);
contracts are versioned with effective dates and the solver reads the contract effective on each
shift date; employees can be archived and imported from CSV with a validation report; a report
lists certifications expiring within N days.

## M3 Availability and time off

Tickets: RO-130..RO-133.

Exit criteria: employees declare recurring weekly availability with exceptions; time-off
requests flow through approve/reject with a preview of affected shifts; approved time off and
availability feed the solver's unavailability automatically; balances prevent over-requesting.

## M4 Demand forecasting and coverage

Tickets: RO-140..RO-143, RO-150, RO-151.

Exit criteria: historical volumes import per location and 15-minute interval; forecasts use
moving averages with weekday/hour seasonality and report MAPE on a holdout week; coverage
requirements convert workload to headcount; shift demand is produced from the coverage curve and
from templates, DST-safe.

## M5 Solver depth, editing and publishing

Tickets: RO-160..RO-166, RO-170..RO-174.

Exit criteria: solves run as cancellable background jobs with progress; a labor rule engine
evaluates jurisdiction rule sets (daily overtime, breaks, minors, night limits); rest and
consecutive days carry over from the previous week; "why can't X work Y?" explanations; tabu
and reheating improve soft score by at least 10% on the benchmark; drag-and-drop editing with
live violations; optimistic concurrency (409 on stale version); publishing freezes an immutable
version and notifies staff in-app.

## M6 Shift marketplace and self-service

Tickets: RO-180..RO-183, RO-230, RO-231.

Exit criteria: employees request swaps and claim open shifts only when the rule evaluators
accept the result; managers approve; staff see their own schedule and subscribe to a signed
iCalendar feed.

## M7 Time and attendance

Tickets: RO-190..RO-192, RO-200, RO-201.

Exit criteria: kiosks punch in/out by PIN with server timestamps; rounding and tolerance rules
create exceptions; timesheets compare punches with the schedule and lock on approval.

## M8 Payroll, reporting and compliance

Tickets: RO-210, RO-220..RO-222.

Exit criteria: payroll CSV export with regular/overtime/night-differential lines reconciles to
approved timesheets; fairness, labor-cost and compliance reports run in under 2 s for 500 staff
over 13 weeks.

## M9 Hardening and general availability

Tickets: RO-105, RO-107, RO-240..RO-246.

Exit criteria: WCAG 2.2 AA on grid and forms; 500 staff x 4 weeks solves in under 30 s;
rate-limit counters shared in PostgreSQL so several API instances can run; backup/restore drill
automated; metrics endpoint; UI translated; Playwright suite in CI; employee data export and
erasure.
