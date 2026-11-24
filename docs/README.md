# Rostra documentation

Rostra is a workforce scheduling and rostering platform for hospitals, retail stores and
call centers. Its core is an in-house constraint solver that turns staff contracts,
skills, availability and shift demand into a weekly roster, and explains every rule it
could not satisfy.

The repository is at roughly 10% of its target scope (see
[planning/implementation-status.md](planning/implementation-status.md)): the foundation and the
first vertical slice (constraint model, rule evaluators, solver, rosters API and week grid)
are implemented; everything else is specified here and tracked in the backlog.

## Product

| Document                                                                     | Purpose                                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [product/PRD.md](product/PRD.md)                                             | Vision, problem, personas, goals, scope, metrics, releases     |
| [product/requirements.md](product/requirements.md)                           | Numbered functional (FR) and non-functional (NFR) requirements |
| [product/user-stories.md](product/user-stories.md)                           | Epics and stories with Given/When/Then acceptance criteria     |
| [product/requirements-traceability.md](product/requirements-traceability.md) | FR -> epic -> ticket -> module -> test -> status               |

## Architecture and design

| Document                                                                 | Purpose                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [architecture/overview.md](architecture/overview.md)                     | C4 context, container and component views; request lifecycle  |
| [architecture/quality-attributes.md](architecture/quality-attributes.md) | Measurable quality targets and how they are verified          |
| [adr/README.md](adr/README.md)                                           | Index of architecture decision records (ADR-0001 .. ADR-0017) |
| [design/system-design.md](design/system-design.md)                       | State machines, sequences, solver algorithms, concurrency     |
| [design/data-model.md](design/data-model.md)                             | Target ERD, table notes, indexes, migrated vs planned tables  |

## API, security, testing, operations

| Document                                             | Purpose                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| [api/openapi.yaml](api/openapi.yaml)                 | OpenAPI 3.1 of the full target API (`x-status` per operation)     |
| [api/README.md](api/README.md)                       | Conventions, envelope, errors, pagination, auth, curl examples    |
| [security/threat-model.md](security/threat-model.md) | STRIDE analysis, trust boundaries, ASVS mapping                   |
| [testing/test-strategy.md](testing/test-strategy.md) | Test pyramid, coverage targets, acceptance matrix                 |
| [operations/runbook.md](operations/runbook.md)       | Configuration, run/migrate/seed, backup/restore, troubleshooting  |
| [operations/deployment.md](operations/deployment.md) | systemd + nginx + native PostgreSQL deployment, release, rollback |

## Planning

| Document                                                               | Purpose                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| [planning/roadmap.md](planning/roadmap.md)                             | Milestones M0..M9 with exit criteria             |
| [planning/backlog.md](planning/backlog.md)                             | Every ticket with estimate, status, dependencies |
| [planning/implementation-status.md](planning/implementation-status.md) | What is done, what is stubbed, % by area         |
| [planning/risks.md](planning/risks.md)                                 | Risk register                                    |
| [glossary.md](glossary.md)                                             | Domain vocabulary                                |
