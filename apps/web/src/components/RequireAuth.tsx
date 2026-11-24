import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <p className="content muted">Loading…</p>;
  return me ? <>{children}</> : <Navigate to="/login" replace />;
}
