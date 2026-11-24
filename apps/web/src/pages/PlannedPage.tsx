import { useParams } from 'react-router-dom';
import { NAV_ITEMS } from '../components/nav';
import { PlannedBadge } from '../components/PlannedBadge';

export function PlannedPage() {
  const { section = '' } = useParams();
  const item = NAV_ITEMS.find((i) => i.to.endsWith(`/${section}`));
  return (
    <div>
      <h1>
        {item?.label ?? 'Planned section'} <PlannedBadge milestone={item?.planned?.milestone} />
      </h1>
      <p>
        This area is on the roadmap
        {item?.planned ? ` for ${item.planned.milestone} (ticket ${item.planned.ticket})` : ''}. See
        docs/planning/roadmap.md for scope and exit criteria.
      </p>
    </div>
  );
}
