-- Scheduling slice: weekly rosters, shift demand, solver runs and assignments.

CREATE TABLE rosters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name            text NOT NULL,
  week_start      date NOT NULL,
  timezone        text NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version         integer NOT NULL DEFAULT 1,
  created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rosters_org_week_idx ON rosters (organization_id, week_start DESC);

CREATE TABLE shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id   uuid NOT NULL REFERENCES rosters (id) ON DELETE CASCADE,
  skill_id    uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  label       text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  headcount   smallint NOT NULL CHECK (headcount BETWEEN 1 AND 50),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '16 hours')
);
CREATE INDEX shifts_roster_start_idx ON shifts (roster_id, starts_at);

CREATE TABLE solver_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id       uuid NOT NULL REFERENCES rosters (id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  seed            bigint NOT NULL,
  iterations      integer NOT NULL,
  hard_score      integer NOT NULL,
  soft_score      integer NOT NULL,
  greedy_hard     integer NOT NULL,
  greedy_soft     integer NOT NULL,
  coverage_ratio  numeric(6,5) NOT NULL,
  elapsed_ms      integer NOT NULL,
  stats           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX solver_runs_roster_idx ON solver_runs (roster_id, created_at DESC);

CREATE TABLE assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id       uuid NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  pinned         boolean NOT NULL DEFAULT false,
  source         text NOT NULL CHECK (source IN ('solver', 'manual')),
  solver_run_id  uuid REFERENCES solver_runs (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, employee_id)
);
CREATE INDEX assignments_employee_idx ON assignments (employee_id);
