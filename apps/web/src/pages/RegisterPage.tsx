import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    organizationName: '',
    name: '',
    email: '',
    password: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await register(form);
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={(e) => void onSubmit(e)}>
        <h1>Create your organization</h1>
        <label>
          Organization name
          <input
            value={form.organizationName}
            onChange={update('organizationName')}
            required
            minLength={2}
          />
        </label>
        <label>
          Your name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>
          Password (12+ characters)
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            required
            minLength={12}
          />
        </label>
        <label>
          Time zone
          <input value={form.timezone} onChange={update('timezone')} required />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="btn" type="submit">
          Create account
        </button>
        <p className="muted">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
