# Rostra API

Base URL in development: `http://127.0.0.1:4108` (the web dev server proxies `/api`). The full
target surface is in [openapi.yaml](openapi.yaml): 26 operations are implemented and 65 are
pending. Every operation carries `x-status`; pending ones also carry `x-ticket`.

## Conventions

- JSON in and out; `content-type: application/json` on bodies; 1 MiB body limit.
- Resource ids are UUIDs; malformed ids return 422.
- Instants are ISO-8601 UTC (`2026-03-02T12:00:00Z`); calendar dates are `YYYY-MM-DD`; time zones
  are IANA names in any spelling, stored canonically (`america/chicago` becomes `America/Chicago`).
- Money is integer minor units (`hourlyRateMinor: 4200` is 42.00 per hour).
- Every response has an `x-request-id` header (an incoming safe `x-request-id` is echoed).

## Envelope

```json
{ "data": { "...": "..." }, "error": null, "meta": { "total": 20, "limit": 50, "offset": 0 } }
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "Request validation failed",
  "details": [{ "path": "contract.minHoursPerWeek", "message": "minHoursPerWeek must not exceed maxHoursPerWeek" }] } }
```

## Errors

| Status | Code                                   | When                                                                       |
| ------ | -------------------------------------- | -------------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`, `REGISTRATION_FAILED`   | malformed JSON; registration rejected (generic)                            |
| 401    | `UNAUTHORIZED`, `INVALID_CREDENTIALS`  | no or expired session; wrong email/password                                |
| 403    | `FORBIDDEN`, `CSRF_FAILED`             | missing permission; CSRF header missing or mismatched                      |
| 404    | `NOT_FOUND`                            | unknown route or resource (also for other tenants' ids)                    |
| 409    | `CONFLICT`                             | roster not in draft; duplicate skill code                                  |
| 422    | `VALIDATION_FAILED`, `INVALID_PROBLEM` | schema errors; scheduling input inconsistent (over-headcount, unknown ids) |
| 429    | `RATE_LIMITED`                         | throttled; `Retry-After` header and `details.retryAfterSeconds`            |
| 501    | `NOT_IMPLEMENTED`                      | planned endpoint; `details.ticket` names the backlog item                  |
| 503    | `NOT_READY`                            | readiness probe failed                                                     |

## Pagination

`GET /api/v1/employees` and `/api/v1/audit-logs` accept `limit` (1-200, default 50) and `offset`
and return `meta.total`. Other lists are bounded (rosters 200, solver runs 50); cursor pagination
arrives with larger lists.

## Authentication and CSRF

1. `GET /api/v1/auth/csrf` sets the readable `rostra_csrf` cookie and returns the token.
2. `POST /api/v1/auth/login` (or `/register`) with header `x-csrf-token: <token>` sets the
   HttpOnly `rostra_session` cookie and returns a new session-bound CSRF token.
3. Every `POST/PUT/PATCH/DELETE` must send `x-csrf-token` equal to the `rostra_csrf` cookie and
   to the session's token.

Roles: owner, admin, scheduler, manager, employee (see `packages/shared/src/model/permissions.ts`).

## curl walkthrough (demo seed)

```bash
B=http://127.0.0.1:4108/api/v1; J=$(mktemp)
T=$(curl -s -c $J $B/auth/csrf | jq -r .data.csrfToken)
T=$(curl -s -b $J -c $J -H "x-csrf-token: $T" -H 'content-type: application/json' \
  -d '{"email":"scheduler@rostra.test","password":"rostra-demo-password"}' $B/auth/login | jq -r .data.csrfToken)
curl -s -b $J $B/auth/me | jq .data.user
R=$(curl -s -b $J $B/rosters | jq -r '.data[0].id')
curl -s -b $J $B/rosters/$R/shifts | jq '.data | length'
curl -s -b $J -H "x-csrf-token: $T" -H 'content-type: application/json' \
  -d '{"seed":42,"iterations":20000}' $B/rosters/$R/solve | jq '.data.run, .data.schedule.evaluation.score'
curl -s -b $J $B/rosters/$R/schedule | jq '.data.evaluation.violations[0]'
curl -s -b $J -X POST -H "x-csrf-token: $T" $B/rosters/$R/publish | jq .error   # 501, RO-170
```
