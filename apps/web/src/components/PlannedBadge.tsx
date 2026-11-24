export function PlannedBadge({ milestone }: { milestone?: string }) {
  return (
    <span
      className="badge badge-planned"
      title={milestone ? `Planned for ${milestone}` : 'Planned'}
    >
      Planned
    </span>
  );
}
