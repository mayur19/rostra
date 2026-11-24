import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LoginPage } from './pages/LoginPage';
import { PlannedPage } from './pages/PlannedPage';
import { RegisterPage } from './pages/RegisterPage';
import { RosterPage } from './pages/RosterPage';
import { RostersPage } from './pages/RostersPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="rosters" element={<RostersPage />} />
        <Route path="rosters/:id" element={<RosterPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="planned/:section" element={<PlannedPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
