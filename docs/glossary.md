# Glossary

| Term                        | Meaning in Rostra                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization                | Tenant. Every row carries `organization_id`, and every repository query filters on it.                                                                     |
| Location                    | Physical site with its own IANA time zone (planned, RO-110).                                                                                               |
| Department                  | Unit within a location (for example Ward 4B, or the front-end team) that owns rosters and approvals (planned, RO-111).                                     |
| Position                    | Job role that implies required skills and default pay (planned, RO-112).                                                                                   |
| Skill                       | Qualification code such as `RN`, `CNA`, `CHARGE`. Shifts require exactly one skill.                                                                        |
| Certification / skill grant | An employee's skill, optionally with an expiry date (`expiresOn`, last valid local date).                                                                  |
| Contract                    | Working terms: min/max weekly hours, overtime threshold, max consecutive days, minimum rest, max shifts per day. Embedded in `employees` today (ADR-0015). |
| Unavailability              | Interval (`tstzrange`) in which an employee cannot work, either `time_off` or `unavailable`.                                                               |
| Preference                  | Soft wish: preferred days off (ISO weekdays), avoid nights.                                                                                                |
| Roster                      | One week of scheduling for an organization, in one time zone, with status draft / published / archived.                                                    |
| Week start                  | First local date of the seven-day roster period.                                                                                                           |
| Shift (demand)              | A time interval needing `headcount` people with a given skill.                                                                                             |
| Slot                        | One head of a shift. A shift with headcount 3 has three slots; the solver assigns slots.                                                                   |
| Assignment                  | An employee placed in a shift slot; `pinned` assignments are kept by the solver; `source` is `solver` or `manual`.                                         |
| Hard constraint             | Rule a valid roster must satisfy (skill, availability, overlap, rest, max hours, consecutive days, shifts per day, coverage).                              |
| Soft constraint             | Rule a good roster should satisfy (minimum hours, day-off preference, nights, overtime, fairness).                                                         |
| Penalty                     | Integer cost of one violation: weight x magnitude (for example 2 per started hour of missing rest).                                                        |
| Score                       | Pair (hard, soft) of summed penalties; compared lexicographically. Feasible means hard = 0.                                                                |
| HARD_MULTIPLIER             | 1 000 000; collapses (hard, soft) into one number for search so hard always dominates.                                                                     |
| Violation                   | Explainable record: constraint id, severity, penalty, employee, shifts and a sentence.                                                                     |
| Greedy construction         | First solver phase: fill the most constrained slots first with the cheapest candidate.                                                                     |
| Simulated annealing         | Second phase: random reassign/swap moves accepted by the Metropolis rule under a cooling temperature.                                                      |
| Seed                        | Integer driving the solver's PRNG; with the iteration budget it makes a run reproducible.                                                                  |
| Iteration budget            | Number of annealing moves; deliberately not a wall-clock limit, for determinism.                                                                           |
| Solver run                  | Persisted record of one solve: seed, iterations, greedy and final score, coverage, elapsed time.                                                           |
| Coverage                    | Filled slots / total slots.                                                                                                                                |
| Utilization                 | Assigned hours / contracted minimum hours for one employee.                                                                                                |
| Fairness                    | Variance of utilization across employees with a non-zero minimum (ADR-0016).                                                                               |
| Night shift                 | Shift starting at or after 20:00 or before 05:00 local time.                                                                                               |
| DST gap / overlap           | Spring-forward hour that does not exist / fall-back hour that happens twice; resolved forward / to the earlier instant.                                    |
| Open shift                  | Unfilled slot offered to eligible staff (planned, RO-183).                                                                                                 |
| Swap                        | Exchange of assignments between employees, checked by the evaluators (planned, RO-180).                                                                    |
| Kiosk punch                 | Clock-in/out at a shared device by PIN (planned, RO-190).                                                                                                  |
| Timesheet                   | Worked time per employee per period, derived from punches and compared with the schedule (planned, RO-200).                                                |
| Outbox                      | Table of messages that would be emailed; Rostra never sends email itself.                                                                                  |
