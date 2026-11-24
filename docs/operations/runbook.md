# Runbook

## Configuration

All configuration comes from environment variables (`.env` in development, a systemd
`EnvironmentFile` in production), validated by zod at startup; the process exits with every
problem listed if anything is invalid.

| Variable                                              | Default                          | Notes                                                                                                                         |
| ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                            | `development`                    | `production` enables extra startup checks                                                                                     |
| `API_HOST` / `API_PORT`                               | `127.0.0.1` / `4108`             | API listens on loopback; nginx fronts it                                                                                      |
| `WEB_PORT` / `APP_ORIGIN`                             | `5108` / `http://localhost:5108` | Vite dev server and proxy                                                                                                     |
| `DATABASE_URL`                                        | none (required)                  | e.g. `postgresql://localhost:5432/rostra_dev?host=/tmp`                                                                       |
| `TEST_DATABASE_URL`                                   | none                             | must contain `test` in the database name                                                                                      |
| `SESSION_SECRET`                                      | none (required, >= 32 chars)     | keys session-token HMACs; `run.sh` writes a random one                                                                        |
| `SESSION_TTL_HOURS`                                   | `12`                             | absolute session lifetime                                                                                                     |
| `COOKIE_SECURE`                                       | `false`                          | must be `true` in production                                                                                                  |
| `TRUST_PROXY`                                         | `false`                          | `false`, a hop count, or proxy IPs/CIDRs; `true` rejected; **must be set explicitly in production** (startup fails otherwise) |
| `LOG_LEVEL`                                           | `info`                           | pino level                                                                                                                    |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | `10` / `900000`                  | per IP+email window                                                                                                           |
| `LOGIN_IP_RATE_LIMIT_MAX`                             | `50`                             | per IP per window (spraying)                                                                                                  |
| `LOGIN_IP_DISTINCT_EMAILS_MAX`                        | `20`                             | distinct emails one IP or IPv6 /64 may try per window                                                                         |
| `LOGIN_EMAIL_FREE_ATTEMPTS`                           | `5`                              | failures before backoff starts                                                                                                |
| `LOGIN_EMAIL_BACKOFF_BASE_MS` / `_MAX_MS`             | `30000` / `3600000`              | doubling lockout and its cap                                                                                                  |
| `LIMITER_MAX_KEYS`                                    | `50000`                          | precise map cap per limiter (sketch is fixed size)                                                                            |
| `REGISTER_RATE_LIMIT_MAX` / `_WINDOW_MS`              | `5` / `3600000`                  | sign-ups per IP                                                                                                               |
| `SOLVER_MAX_ITERATIONS`                               | `200000`                         | upper bound on annealing moves per request                                                                                    |

Rate-limit state is per process (ADR-0017): run a single API instance per database until RO-107.

## Everyday commands

```bash
./run.sh            # setup + start API (4108) and web (5108)
./run.sh setup      # prerequisites, .env, deps, create DB, migrate, seed if empty
./run.sh migrate    # apply pending migrations
./run.sh seed       # demo ward (empty database only)
./run.sh reset      # drop schema, migrate, seed (asks; --yes to skip)
./run.sh test       # all tests against TEST_DATABASE_URL
npm run bench       # solver benchmark
```

Demo accounts (development only): `owner@rostra.test`, `scheduler@rostra.test`,
`manager@rostra.test`, password `rostra-demo-password`.

## Migrations

Plain SQL in `apps/api/migrations/NNNN_name.sql`, applied in order, each in its own transaction,
recorded in `schema_migrations` with a SHA-256 checksum. Editing an applied file aborts startup of
the migrator: add a new migration instead. Production: `node dist/cli.js migrate` from
`apps/api` before restarting the service.

## Backup and restore

```bash
# nightly logical backup (custom format, compressed)
pg_dump --format=custom --no-owner --file=/var/backups/rostra/rostra-$(date +%F).dump rostra
# keep 14 days
find /var/backups/rostra -name 'rostra-*.dump' -mtime +14 -delete

# restore into a fresh database
createdb rostra_restore
pg_restore --no-owner --dbname=rostra_restore /var/backups/rostra/rostra-2026-11-25.dump
psql rostra_restore -c 'SELECT count(*) FROM schema_migrations'
```

Verify a restore monthly by pointing a staging API at the restored database and calling
`/api/v1/ready` and the schedule of a known roster.

## Health checks

- `GET /api/v1/health`: process up (no dependencies).
- `GET /api/v1/ready`: database reachable and migrations table readable; 503 otherwise.

## Troubleshooting

| Symptom                                        | Likely cause                                                        | Action                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Invalid configuration: ...` at start          | Missing or invalid env var                                          | Fix the listed variables; in production set `TRUST_PROXY` and `COOKIE_SECURE=true`                                  |
| `Cannot reach PostgreSQL via ...` from run.sh  | Server not running or wrong socket                                  | `brew services start postgresql@17` / `sudo systemctl start postgresql`; check `host=/tmp` vs `/var/run/postgresql` |
| `Migration X was modified after being applied` | Applied file edited                                                 | Revert the file; create a new migration                                                                             |
| `/ready` returns 503                           | DB down or not migrated                                             | Check `journalctl -u postgresql`; run migrate                                                                       |
| 403 `CSRF_FAILED`                              | Missing `x-csrf-token` or stale token after login                   | Call `GET /api/v1/auth/csrf`; the web client does this automatically                                                |
| Many 429s on login                             | Throttles working, or proxy misconfigured so all users share one IP | Check `TRUST_PROXY` matches nginx; look for `rate limiter store full` warnings                                      |
| Solve slow                                     | Large roster or high iteration count                                | Lower `iterations`; check `SOLVER_MAX_ITERATIONS`; see benchmark                                                    |
| Solver result unexpected                       | Rules or weights                                                    | Inspect `violations` in the schedule; re-run with the same seed to reproduce                                        |
| Shift times off by an hour                     | Wrong roster time zone                                              | Rosters store IANA names; check `timezone` on the roster                                                            |
