import { useState } from 'react'

interface AuthPageProps {
  onLogin: (user: { id: string; name: string; role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'; pin?: string; store_id?: string; active?: boolean }) => void
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [tab, setTab] = useState<'login' | 'signup' | 'guest'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
      if (!supabaseUrl || !supabaseKey) {
        onLogin({ id: 'guest', name: email || 'User', role: 'owner' })
        return
      }
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      onLogin({ id: data.user?.id || 'user', name: data.user?.email || 'User', role: 'owner' })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
      if (!supabaseUrl || !supabaseKey) {
        onLogin({ id: 'guest', name: name || email || 'User', role: 'owner' })
        return
      }
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data: _data, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) throw authError
      setError('Account created! Please check your email to confirm.')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = () => {
    onLogin({ id: 'guest_' + Date.now(), name: 'Guest', role: 'cashier' })
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <h1>My POS</h1>
        <p className="subtitle">Point of Sale System</p>

        <div className="auth-tabs">
          <div className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Login</div>
          <div className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Sign Up</div>
          <div className={`auth-tab ${tab === 'guest' ? 'active' : ''}`} onClick={() => setTab('guest')}>Guest</div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {tab === 'guest' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '.7rem', color: 'var(--t3)', marginBottom: 12 }}>
              Continue without an account. Data is stored locally.
            </p>
            <button className="auth-btn" onClick={handleGuest}>Continue as Guest</button>
          </div>
        )}

        {tab === 'login' && (
          <>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin() }} />
            </div>
            <button className="auth-btn" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </>
        )}

        {tab === 'signup' && (
          <>
            <div className="form-group">
              <label>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button className="auth-btn" onClick={handleSignup} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </>
        )}

        <button className="auth-guest-btn" onClick={handleGuest}>Skip &amp; Continue as Guest</button>
      </div>
    </div>
  )
}
