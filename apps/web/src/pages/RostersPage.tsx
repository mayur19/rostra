import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Roster } from '../api/types';
import { useLoad } from './useLoad';

export function RostersPage() {
  const { data: rosters, error } = useLoad(
    async () => (await api.get<Roster[]>('/api/v1/rosters')).data,
    [],
  );
  return (
    <div>
      <h1>Rosters</h1>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Week of</th>
            <th>Time zone</th>
            <th>Shifts</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rosters?.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/app/rosters/${r.id}`}>{r.name}</Link>
              </td>
              <td>{r.weekStart}</td>
              <td>{r.timezone}</td>
              <td>{r.shiftCount}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
