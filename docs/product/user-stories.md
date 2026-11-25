# User stories

Stories are grouped by epic (see [backlog](../planning/backlog.md)). Each has acceptance
criteria in Given/When/Then form. Stories marked **(done)** are implemented and tested.

## E1 Identity & access

### US-101 Register my organization (done)

As an organization owner I want to create my organization and account so that I can start scheduling.

- **Given** no account exists for `olivia@ward4b.example`
  **When** I submit organization "Ward 4B", my name, that email, a 14-character password and zone `america/new_york`
  **Then** I receive 201, a session cookie, and my organization's zone is stored as `America/New_York`.
- **Given** that email is already registered **When** I register again **Then** I get 400 `REGISTRATION_FAILED` with a generic message that does not confirm the account exists.
- **Given** 5 registrations from my IP in the last hour **When** I register again **Then** I get 429.

### US-102 Sign in safely (done)

As a scheduler I want to sign in so that only I can change my rosters.

- **Given** valid credentials **When** I log in **Then** an HttpOnly session cookie and a CSRF cookie are set.
- **Given** a wrong password **When** I log in **Then** I get 401 `INVALID_CREDENTIALS` with the same message as for an unknown email.
- **Given** 10 failed attempts in 15 minutes from my IP for my email **When** I try again **Then** I get 429 with `Retry-After`.
- **Given** an attacker tries 50 different emails from one IP within 15 minutes **When** they try a 51st **Then** they get 429.
- **Given** 5 failed attempts for my email from any IPs **When** a 6th fails **Then** further attempts for that email wait 30 s, then 60 s, ... capped at 1 h, and a successful login resets the counter.

### US-103 Forged requests are rejected (done)

- **Given** I am signed in **When** a request without the `x-csrf-token` header tries to solve a roster **Then** it is refused with 403 `CSRF_FAILED` and nothing changes.

### US-104 Least privilege (done)

- **Given** I am a `manager` **When** I call solve **Then** I get 403; **When** I read the schedule **Then** I get 200.

### US-105 Invite colleagues (pending, RO-102)

- **Given** I am an admin **When** I invite `sam@ward4b.example` as scheduler **Then** an outbox message with a single-use link is recorded and Sam can set a password within 7 days.

## E2 Workforce model

### US-201 Maintain staff records (done)

As a scheduler I want to record contracts, skills and preferences so that the solver respects them.

- **Given** skill `RN` exists **When** I create Ava with 32-48 h, 5 consecutive days max, 11 h rest and RN expiring 2026-12-31 **Then** she is returned with version 1.
- **Given** skill `ICU` does not exist **When** I grant it **Then** I get 422 "Unknown skill ICU".
- **Given** Ava exists **When** I PATCH `preferences.avoidNights=true` **Then** other fields are unchanged and version is 2.

### US-202 Lapsed certifications block assignment (done)

- **Given** Ben's CHARGE grant expires on Wednesday **When** a Thursday charge shift is evaluated with Ben **Then** a `SKILL_EXPIRED` hard violation names Ben, the skill and the date.

### US-203 Import staff from a spreadsheet (pending, RO-121)

- **Given** a CSV with 120 rows of which 3 are invalid **When** I import **Then** no rows are written and I see the 3 errors with row numbers.

## E3 Demand & coverage

### US-301 Expand weekly patterns (done in domain, API pending RO-151)

- **Given** a Night RN template 22:00 for 8 h in `America/New_York` **When** expanded for the week containing the fall-back Sunday **Then** that night lasts 9 real hours and is paid as such.

### US-302 Forecast demand (pending, RO-140)

- **Given** 12 weeks of call volumes **When** I forecast next week **Then** I see hourly volumes with weekday seasonality and a backtest error.

## E4 Solver & rules

### US-401 Produce a roster in one click (done)

As a scheduler I want the system to fill the week so that I only review exceptions.

- **Given** the seeded ward (20 staff, 68 slots) **When** I solve with seed 42 and 20,000 iterations **Then** coverage is 100%, the hard score is 0 and the soft score is not worse than the greedy start.
- **Given** an ICU shift and no ICU-qualified staff **When** I solve **Then** the slot stays empty and an `UNFILLED_SLOT` violation says it needs 1 more ICU staff.

### US-402 Reproduce yesterday's roster (done)

- **Given** unchanged data **When** I solve again with the same seed and iterations **Then** assignments are identical.

### US-403 Keep my manual choices (done)

- **Given** I pinned Ava to Saturday day **When** I re-solve **Then** Ava stays on Saturday day even if it costs soft score.

### US-404 Understand rule breaches (done)

- **Given** Chloe works 23:00 then 07:00 **When** I view violations **Then** I read "Chloe ... gets 8.0h rest between ... (minimum 11h)".

### US-405 Background solving for large sites (pending, RO-160)

- **Given** a 500-person, 4-week roster **When** I start a solve **Then** I can leave the page, watch progress and cancel.

## E5 Schedule editing & publish

### US-501 See the week at a glance (done)

- **Given** a solved roster **When** I open it **Then** I see employees as rows, days as columns, each cell with shift labels, plus coverage, cost, hours and the violation list.

### US-502 Try an edit before saving (done)

- **Given** a schedule **When** I post a proposed assignment set to evaluate **Then** I get the new score and violations without anything being stored.

### US-503 Save manual edits atomically (done)

- **Given** a draft roster **When** I PUT a full assignment set with pins **Then** it replaces the old set in one transaction and an audit entry records counts.
- **Given** a published roster **When** I PUT assignments **Then** I get 409.

### US-504 Publish and notify (pending, RO-170/RO-171)

- **Given** a feasible draft **When** I publish **Then** affected employees get an in-app notification and the version is frozen.

## E6 Availability & time off (pending)

### US-601 Request time off (RO-131/RO-132)

- **Given** I am an employee **When** I request 2026-12-24 to 2026-12-26 **Then** my manager sees it with the shifts it would uncover, and after approval the solver treats me as unavailable.

## E7 Shift marketplace (pending)

### US-701 Swap a shift (RO-180..RO-182)

- **Given** I hold Tuesday night **When** I offer it to Dev **Then** the system checks Dev against all rules, Dev accepts, my manager approves, and both schedules update.

## E8 Time & attendance (pending)

### US-801 Punch at the kiosk (RO-190)

- **Given** a registered kiosk **When** I enter my PIN at 06:58 **Then** a punch-in with the server timestamp is recorded against my 07:00 shift.

## E9 Payroll & reporting (pending)

### US-901 Export payroll (RO-210)

- **Given** approved timesheets for a pay period **When** I export **Then** I get a CSV with regular, overtime and night lines whose totals match the timesheets.

### US-902 Prove fairness (RO-220)

- **Given** 12 weeks of rosters **When** I open the fairness report **Then** I see weekend and night counts and hour utilization per employee with outliers highlighted.
