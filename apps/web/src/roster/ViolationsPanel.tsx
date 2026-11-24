import { CONSTRAINTS, type Violation } from '@rostra/shared';

const TITLES = new Map(CONSTRAINTS.map((c) => [c.id, c.title] as const));

export function ViolationsPanel({
  violations,
  limit = 50,
}: {
  violations: readonly Violation[];
  limit?: number;
}) {
  if (violations.length === 0) {
    return (
      <section className="panel" aria-label="Violations">
        <h3>Violations</h3>
        <p className="ok">No rule violations. The roster satisfies every hard and soft rule.</p>
      </section>
    );
  }
  const hard = violations.filter((v) => v.severity === 'hard').length;
  return (
    <section className="panel" aria-label="Violations">
      <h3>
        Violations{' '}
        <span className="muted">
          ({hard} hard, {violations.length - hard} soft)
        </span>
      </h3>
      <ul className="violations">
        {violations.slice(0, limit).map((v, i) => (
          <li key={`${v.constraint}-${i}`} className={`violation ${v.severity}`}>
            <span className={`badge badge-${v.severity}`}>{v.severity}</span>
            <strong>{TITLES.get(v.constraint) ?? v.constraint}</strong>
            <span>{v.message}</span>
            <span className="muted">−{v.penalty}</span>
          </li>
        ))}
      </ul>
      {violations.length > limit && <p className="muted">…and {violations.length - limit} more</p>}
    </section>
  );
}
