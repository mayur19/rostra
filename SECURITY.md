# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's "Report a vulnerability"
(security advisories) on this repository. Include steps to reproduce and the affected commit.
Expect an acknowledgement within 3 working days. Please do not open public issues for security
problems.

## Supported versions

Only the latest `main` is supported while the project is pre-1.0.

## Security model in brief

- Server-side sessions (HttpOnly, SameSite=Lax, Secure in production), tokens stored as HMACs.
- CSRF double-submit token bound to the session on every mutating request.
- scrypt password hashing; login throttling per IP, per IP+email, per source and per email with a
  non-evictable sketch (ADR-0006, ADR-0017); generic registration errors.
- Tenant isolation in the repository layer; RBAC per role; append-only audit log.
- zod validation at every boundary; parameterised SQL only; log redaction of secrets.
- Rate-limit state is per process: run one API instance per database until RO-107.

Details: [docs/security/threat-model.md](docs/security/threat-model.md).
