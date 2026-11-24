import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../src/components/Layout';
import { NAV_ITEMS } from '../src/components/nav';
import { buildGrid } from '../src/roster/grid-model';
import { ViolationsPanel } from '../src/roster/ViolationsPanel';
import { WeekGrid } from '../src/roster/WeekGrid';
import { TZ, WEEK, assignments, employees, shifts, violations } from './fixtures';

describe('WeekGrid', () => {
  it('renders employees, day headers, chips and open slots', () => {
    const model = buildGrid({
      weekStart: WEEK,
      timezone: TZ,
      shifts,
      employees,
      assignments,
      violations,
    });
    render(<WeekGrid model={model} />);
    expect(screen.getByRole('columnheader', { name: /Mon 03-02/ })).toBeInTheDocument();
    const avaRow = screen.getByRole('row', { name: /Ava Patel/ });
    expect(within(avaRow).getByText('07:00-15:00')).toBeInTheDocument();
    expect(within(avaRow).getByText('RN · pinned')).toBeInTheDocument();
    expect(screen.getByText(/1 × Day RN/)).toBeInTheDocument();
    expect(screen.getByText('16.0h · 1 issues')).toBeInTheDocument();
  });
});

describe('ViolationsPanel', () => {
  it('summarises hard and soft violations with titles', () => {
    render(<ViolationsPanel violations={violations} />);
    expect(screen.getByRole('heading', { name: /2 hard, 1 soft/ })).toBeInTheDocument();
    expect(screen.getByText('Shift slot left unfilled')).toBeInTheDocument();
    expect(screen.getByText('Ben lacks a skill')).toBeInTheDocument();
  });

  it('truncates long lists and celebrates a clean roster', () => {
    const { rerender } = render(<ViolationsPanel violations={violations} limit={1} />);
    expect(screen.getByText('…and 2 more')).toBeInTheDocument();
    rerender(<ViolationsPanel violations={[]} />);
    expect(screen.getByText(/No rule violations/)).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('shows every section and badges planned ones', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(NAV_ITEMS.length);
    expect(screen.getAllByText('Planned')).toHaveLength(NAV_ITEMS.filter((i) => i.planned).length);
    expect(within(screen.getByRole('link', { name: /Rosters/ })).queryByText('Planned')).toBeNull();
    expect(
      within(screen.getByRole('link', { name: /Payroll/ })).getByText('Planned'),
    ).toBeInTheDocument();
  });
});
