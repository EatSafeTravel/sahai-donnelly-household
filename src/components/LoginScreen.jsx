import { useState } from 'react';
import { supabase, HOUSEHOLD_EMAIL } from '../lib/supabase';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin.trim()) return;
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: HOUSEHOLD_EMAIL,
      password: pin,
    });
    if (error) setError('Incorrect PIN — please try again.');
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">Household</div>
        <p className="login-sub">Enter your family PIN to continue</p>
        <form onSubmit={handleSubmit}>
          <input
            className="login-pin"
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? <><span className="spinner"></span>Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
