-- Workforce slice: skills, employees with embedded contract terms, skill grants, unavailability.
-- Locations, departments, positions and versioned contracts are planned (see data-model.md).

CREATE TABLE skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  code            text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE employees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name                  text NOT NULL,
  email                 text,
  hourly_rate_minor     bigint NOT NULL CHECK (hourly_rate_minor >= 0),
  min_hours_per_week    numeric(5,2) NOT NULL CHECK (min_hours_per_week >= 0),
  max_hours_per_week    numeric(5,2) NOT NULL CHECK (max_hours_per_week >= min_hours_per_week),
  overtime_after_hours  numeric(5,2) NOT NULL DEFAULT 40,
  max_consecutive_days  smallint NOT NULL CHECK (max_consecutive_days BETWEEN 1 AND 7),
  min_rest_hours        numeric(4,2) NOT NULL CHECK (min_rest_hours BETWEEN 0 AND 24),
  max_shifts_per_day    smallint NOT NULL DEFAULT 1 CHECK (max_shifts_per_day BETWEEN 1 AND 3),
  preferred_days_off    smallint[] NOT NULL DEFAULT '{}',
  avoid_nights          boolean NOT NULL DEFAULT false,
  version               integer NOT NULL DEFAULT 1,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employees_org_name_idx ON employees (organization_id, name) WHERE archived_at IS NULL;

CREATE TABLE employee_skills (
  employee_id uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  skill_id    uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  expires_on  date,
  PRIMARY KEY (employee_id, skill_id)
);
CREATE INDEX employee_skills_skill_idx ON employee_skills (skill_id);

CREATE TABLE employee_unavailability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  period      tstzrange NOT NULL CHECK (NOT isempty(period)),
  reason      text NOT NULL CHECK (reason IN ('time_off', 'unavailable'))
);
CREATE INDEX employee_unavailability_period_idx ON employee_unavailability USING gist (period);
CREATE INDEX employee_unavailability_employee_idx ON employee_unavailability (employee_id);
