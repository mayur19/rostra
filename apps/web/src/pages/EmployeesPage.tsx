import { api } from '../api/client';
import type { Employee } from '../api/types';
import { useLoad } from './useLoad';

export function EmployeesPage() {
  const { data, error } = useLoad(
    async () => (await api.get<Employee[]>('/api/v1/employees?limit=200')).data,
    [],
  );
  return (
    <div>
      <h1>Employees</h1>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Skills</th>
            <th>Hours (min-max)</th>
            <th>Rest</th>
            <th>Max days in a row</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>
                {e.skills
                  .map((s) => (s.expiresOn ? `${s.skill} (to ${s.expiresOn})` : s.skill))
                  .join(', ')}
              </td>
              <td>
                {e.contract.minHoursPerWeek}-{e.contract.maxHoursPerWeek}
              </td>
              <td>{e.contract.minRestHours}h</td>
              <td>{e.contract.maxConsecutiveDays}</td>
              <td>{(e.hourlyRateMinor / 100).toFixed(2)}/h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
