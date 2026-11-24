export interface NavItem {
  readonly label: string;
  readonly to: string;
  readonly planned?: { ticket: string; milestone: string };
}

/** Primary navigation. Planned sections stay visible so the roadmap is discoverable. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', to: '/app' },
  { label: 'Rosters', to: '/app/rosters' },
  { label: 'Employees', to: '/app/employees' },
  {
    label: 'Time off',
    to: '/app/planned/time-off',
    planned: { ticket: 'RO-131', milestone: 'M3' },
  },
  {
    label: 'Forecasting',
    to: '/app/planned/forecasting',
    planned: { ticket: 'RO-140', milestone: 'M4' },
  },
  {
    label: 'Shift swaps',
    to: '/app/planned/shift-swaps',
    planned: { ticket: 'RO-180', milestone: 'M6' },
  },
  {
    label: 'Time clock',
    to: '/app/planned/time-clock',
    planned: { ticket: 'RO-190', milestone: 'M7' },
  },
  {
    label: 'Timesheets',
    to: '/app/planned/timesheets',
    planned: { ticket: 'RO-200', milestone: 'M7' },
  },
  { label: 'Payroll', to: '/app/planned/payroll', planned: { ticket: 'RO-210', milestone: 'M8' } },
  { label: 'Reports', to: '/app/planned/reports', planned: { ticket: 'RO-220', milestone: 'M8' } },
];
