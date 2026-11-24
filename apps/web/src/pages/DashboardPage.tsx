import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Roster } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useLoad } from './useLoad';

export function DashboardPage() {
  const { me } = useAuth();
  const { data: rosters, error } = useLoad(
    async () => (await api.get<Roster[]>('/api/v1/rosters')).data,
    [],
  );
  return (
    <div>
      <h1>Welcome, {me?.user.name}</h1>
      <p className="muted">
        {me?.organization.name} · {me?.organization.timezone}
      </p>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <h3>Upcoming rosters</h3>
        {rosters?.length === 0 && <p className="muted">No rosters yet.</p>}
        <ul>
          {rosters?.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link to={`/app/rosters/${r.id}`}>{r.name}</Link>{' '}
              <span className="muted">
                ({r.shiftCount} shifts, {r.status})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
