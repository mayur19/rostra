import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NAV_ITEMS } from './nav';
import { PlannedBadge } from './PlannedBadge';

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">Rostra</div>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span>{item.label}</span>
              {item.planned && <PlannedBadge milestone={item.planned.milestone} />}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Layout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <span>{me?.organization.name}</span>
          <span className="spacer" />
          <span className="muted">
            {me?.user.name} · {me?.user.role}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => void logout().then(() => navigate('/login'))}
          >
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
