import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { Schedule, SolverRun } from '../api/types';
import { buildGrid } from '../roster/grid-model';
import { ViolationsPanel } from '../roster/ViolationsPanel';
import { WeekGrid } from '../roster/WeekGrid';
import { useLoad } from './useLoad';

function money(minor: number): string {
  return (minor / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function RosterPage() {
  const { id = '' } = useParams();
  const {
    data: schedule,
    error,
    setData,
  } = useLoad(async () => (await api.get<Schedule>(`/api/v1/rosters/${id}/schedule`)).data, [id]);
  const [seed, setSeed] = useState(1);
  const [iterations, setIterations] = useState(20000);
  const [run, setRun] = useState<SolverRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const grid = useMemo(
    () =>
      schedule &&
      buildGrid({
        weekStart: schedule.roster.weekStart,
        timezone: schedule.roster.timezone,
        shifts: schedule.shifts,
        employees: schedule.employees,
        assignments: schedule.assignments,
        violations: schedule.evaluation.violations,
      }),
    [schedule],
  );

  async function generate() {
    setBusy(true);
    setSolveError(null);
    try {
      const result = await api.post<{ run: SolverRun; schedule: Schedule }>(
        `/api/v1/rosters/${id}/solve`,
        {
          seed,
          iterations,
        },
      );
      setRun(result.data.run);
      setData(result.data.schedule);
    } catch (err) {
      setSolveError(err instanceof ApiError ? err.message : 'Schedule generation failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!schedule || !grid) return <p className="muted">Loading roster…</p>;
  const { metrics, score, feasible } = schedule.evaluation;

  return (
    <div>
      <h1>{schedule.roster.name}</h1>
      <p className="muted">
        Week of {schedule.roster.weekStart} · {schedule.roster.timezone} · {schedule.roster.status}
      </p>
      <section className="toolbar" aria-label="Solver">
        <label>
          Seed
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <label>
          Iterations
          <input
            type="number"
            min={0}
            step={1000}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
          />
        </label>
        <button className="btn" onClick={() => void generate()} disabled={busy}>
          {busy ? 'Solving…' : 'Generate schedule'}
        </button>
        {solveError && <span className="error">{solveError}</span>}
      </section>
      <section className="stats" aria-label="Schedule quality">
        <div className={`stat ${feasible ? 'good' : 'bad'}`}>
          <span className="label">Feasible</span>
          <span className="value">{feasible ? 'Yes' : 'No'}</span>
        </div>
        <div className="stat">
          <span className="label">Score (hard / soft)</span>
          <span className="value">
            {score.hard} / {score.soft}
          </span>
        </div>
        <div className="stat">
          <span className="label">Coverage</span>
          <span className="value">
            {metrics.slotsFilled}/{metrics.slotsTotal}
          </span>
        </div>
        <div className="stat">
          <span className="label">Labor cost</span>
          <span className="value">{money(metrics.laborCostMinor)}</span>
        </div>
        {run && (
          <div className="stat">
            <span className="label">Last run</span>
            <span className="value small">
              greedy {run.greedyHard}/{run.greedySoft} → {run.hardScore}/{run.softScore} in{' '}
              {run.elapsedMs} ms
            </span>
          </div>
        )}
      </section>
      <WeekGrid model={grid} />
      <ViolationsPanel violations={schedule.evaluation.violations} />
    </div>
  );
}
