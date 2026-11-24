import { dayLabel, isoWeekday } from '@rostra/shared';
import type { GridModel } from './grid-model';

export function WeekGrid({ model }: { model: GridModel }) {
  return (
    <div className="grid-wrap">
      <table className="week-grid">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            {model.dates.map((date) => (
              <th scope="col" key={date}>
                {dayLabel(isoWeekday(date))} <span className="muted">{date.slice(5)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.employeeId}>
              <th scope="row">
                <div>{row.name}</div>
                <div className="muted small">
                  {row.hours.toFixed(1)}h
                  {row.violationCount > 0 ? ` · ${row.violationCount} issues` : ''}
                </div>
              </th>
              {row.days.map((cells, day) => (
                <td key={day}>
                  {cells.map((cell) => (
                    <div
                      key={cell.shiftId}
                      className={`chip skill-${cell.skill.toLowerCase()}${cell.flagged ? ' flagged' : ''}`}
                      title={cell.label}
                    >
                      <span>{cell.time}</span>
                      <span className="small">
                        {cell.skill}
                        {cell.pinned ? ' · pinned' : ''}
                      </span>
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {model.openSlots.length > 0 && (
          <tfoot>
            <tr>
              <th scope="row">Open slots</th>
              {model.dates.map((date) => (
                <td key={date}>
                  {model.openSlots
                    .filter((s) => s.date === date)
                    .map((s) => (
                      <div key={s.label} className="chip open">
                        {s.missing} × {s.label.replace(` ${date}`, '')}
                      </div>
                    ))}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
