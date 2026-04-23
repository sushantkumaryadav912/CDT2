import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, LogIn, UserPlus, LogOut, ArrowRight, Home, Loader2 } from 'lucide-react'
import { useCDT } from '../store/CDTContext'
import { loginUser, signupUser } from '../utils/api'
import './Login.css'

function getRedirectTarget(locationState) {
  const from = locationState?.from
  if (typeof from === 'string' && from.startsWith('/') && from !== '/login') {
    return from
  }
  return '/analyze'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTarget = useMemo(() => getRedirectTarget(location.state), [location.state])

  const {
    isAuthenticated,
    currentUser,
    analysisHistory,
    setAuthSession,
    clearAuthSession,
    refreshHistory,
    backendHealth,
  } = useCDT()

  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authFeedback, setAuthFeedback] = useState({ type: '', text: '' })

  const setAuthField = (name, value) => {
    setAuthForm(prev => ({ ...prev, [name]: value }))
  }

  const handleContinue = () => {
    navigate(redirectTarget)
  }

  const handleLogout = () => {
    clearAuthSession()
    setAuthFeedback({ type: 'ok', text: 'Signed out successfully.' })
  }

  const handleAuth = async () => {
    const email = authForm.email.trim()
    const password = authForm.password

    if (!email || !password) {
      setAuthFeedback({ type: 'error', text: 'Email and password are required.' })
      return
    }

    setAuthLoading(true)
    setAuthFeedback({ type: '', text: '' })

    try {
      const requestAuth = authMode === 'signup' ? signupUser : loginUser
      const payload = await requestAuth({ email, password })

      setAuthSession(payload.access_token, payload.user)
      try {
        await refreshHistory(payload.access_token)
      } catch {
        // Authentication success should not fail the login flow when history fetch has issues.
      }

      setAuthForm(prev => ({ ...prev, password: '' }))
      setAuthFeedback({
        type: 'ok',
        text: authMode === 'signup' ? 'Account created and signed in.' : 'Signed in successfully.',
      })

      navigate(redirectTarget, { replace: true })
    } catch (error) {
      setAuthFeedback({ type: 'error', text: error.message || 'Authentication failed' })
    } finally {
      setAuthLoading(false)
    }
  }

  const authBadgeClass = isAuthenticated ? 'badge badge-green' : 'badge badge-red'
  const apiBadgeClass = backendHealth.status === 'online'
    ? 'badge badge-cyan'
    : backendHealth.status === 'checking'
      ? 'badge badge-gold'
      : 'badge badge-red'

  return (
    <div className="login-page animate-fade-in">
      <div className="login-page__header">
        <div className="page-eyebrow">
          <ShieldCheck size={16} className="text-gold" />
          <span className="section-label">Authentication</span>
        </div>
        <h1 className="page-title">Sign In To Continue</h1>
        <p className="page-desc text-secondary">
          Only the Overview page is public. Sign in to access Analyzer, Results, What-If Simulator, and Knowledge Graph.
        </p>
        <div className="login-page__actions">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            <Home size={14} /> Back to Overview
          </button>
          {isAuthenticated && (
            <>
              <button className="btn btn-primary" onClick={handleContinue}>
                Continue <ArrowRight size={14} />
              </button>
              <button className="btn btn-ghost" onClick={handleLogout}>
                <LogOut size={14} /> Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      <div className="login-card card animate-fade-up delay-1">
        <div className="login-card__head">
          <p className="section-label">Access Status</p>
          <div className="login-badges">
            <span className={authBadgeClass}>{isAuthenticated ? 'JWT Active' : 'Logged Out'}</span>
            <span className={apiBadgeClass}>API {backendHealth.status}</span>
          </div>
        </div>

        <p className="login-system-status text-muted mono-font">{backendHealth.message}</p>

        {isAuthenticated ? (
          <div className="login-signed-in">
            <div className="login-user-avatar">
              <ShieldCheck size={32} />
            </div>
            <p className="login-user-title">{currentUser?.email}</p>
            <p className="login-user-meta text-muted mono-font">Saved analyses: {analysisHistory.length}</p>
            <div className="login-signed-in__actions">
              <button className="btn btn-primary" onClick={handleContinue}>
                Continue To Protected Pages <ArrowRight size={14} />
              </button>
              <button className="btn btn-ghost" onClick={handleLogout}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="login-mode-toggle">
              <button
                className={`login-mode-btn ${authMode === 'login' ? 'login-mode-btn--active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                <LogIn size={14} /> Sign In
              </button>
              <button
                className={`login-mode-btn ${authMode === 'signup' ? 'login-mode-btn--active' : ''}`}
                onClick={() => setAuthMode('signup')}
              >
                <UserPlus size={14} /> Sign Up
              </button>
            </div>

            <div className="login-form-grid">
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={e => setAuthField('email', e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Password (min 8 chars)"
                value={authForm.password}
                onChange={e => setAuthField('password', e.target.value)}
              />
              <button className="btn btn-primary login-submit" onClick={handleAuth} disabled={authLoading}>
                {authLoading ? (
                  <><Loader2 size={14} className="spin" /> Working...</>
                ) : authMode === 'signup' ? (
                  <><UserPlus size={14} /> Create Account</>
                ) : (
                  <><LogIn size={14} /> Sign In</>
                )}
              </button>
            </div>
          </>
        )}

        {authFeedback.text && (
          <p className={`login-feedback ${authFeedback.type === 'error' ? 'login-feedback--error' : 'login-feedback--ok'}`}>
            {authFeedback.text}
          </p>
        )}
      </div>
    </div>
  )
}
