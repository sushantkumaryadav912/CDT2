import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Results from './pages/Results'
import WhatIf from './pages/WhatIf'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Login from './pages/Login'
import Profile from './pages/Profile'
import { CDTContext } from './store/CDTContext'
import { fetchAnalysisHistory, fetchUserProfile, getApiHealth, saveUserProfile } from './utils/api'

const AUTH_TOKEN_KEY = 'cdt_auth_token'
const AUTH_USER_KEY = 'cdt_auth_user'

function loadStoredUser() {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeHistory(payload) {
  const history = Array.isArray(payload?.history) ? payload.history : []
  return history.filter(entry => entry && typeof entry === 'object')
}

function normalizeProfile(payload) {
  const profile = payload?.profile
  if (!profile || typeof profile !== 'object') return null
  return profile
}

function RequireAuth({ isAuthenticated, children }) {
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return children
}

export default function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [studentInput, setStudentInput] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(() => loadStoredUser())
  const [analysisHistory, setAnalysisHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Checking backend status...',
  })

  const isAuthenticated = Boolean(authToken)

  const setAuthSession = useCallback((token, user) => {
    const safeToken = token || ''
    const safeUser = user || null

    setAuthToken(safeToken)
    setCurrentUser(safeUser)

    if (safeToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, safeToken)
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }

    if (safeUser) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser))
    } else {
      localStorage.removeItem(AUTH_USER_KEY)
    }
  }, [])

  const clearAuthSession = useCallback(() => {
    setAuthToken('')
    setCurrentUser(null)
    setAnalysisHistory([])
    setHistoryLoading(false)
    setHistoryError('')
    setSelectedHistoryId('')
    setUserProfile(null)
    setProfileLoading(false)
    setProfileError('')
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  }, [])

  const applyHistoryEntry = useCallback((entry) => {
    if (!entry || typeof entry !== 'object') return
    const result = entry.result || null
    const input = entry.input || result?.input || null

    if (result) {
      setAnalysisResult(result)
    }
    if (input) {
      setStudentInput(input)
    }

    setSelectedHistoryId(entry.id || '')
  }, [])

  const refreshHistory = useCallback(async (tokenOverride = authToken) => {
    const token = tokenOverride || ''
    if (!token) {
      setAnalysisHistory([])
      setHistoryError('')
      return []
    }

    setHistoryLoading(true)
    setHistoryError('')
    try {
      const payload = await fetchAnalysisHistory(token, 20)
      const history = normalizeHistory(payload)
      setAnalysisHistory(history)
      return history
    } catch (error) {
      setHistoryError(error.message || 'Failed to fetch analysis history')
      throw error
    } finally {
      setHistoryLoading(false)
    }
  }, [authToken])

  const refreshProfile = useCallback(async (tokenOverride = authToken) => {
    const token = tokenOverride || ''
    if (!token) {
      setUserProfile(null)
      setProfileError('')
      return null
    }

    setProfileLoading(true)
    setProfileError('')
    try {
      const payload = await fetchUserProfile(token)
      const profile = normalizeProfile(payload)
      setUserProfile(profile)
      return profile
    } catch (error) {
      setProfileError(error.message || 'Failed to load profile')
      throw error
    } finally {
      setProfileLoading(false)
    }
  }, [authToken])

  const updateUserProfile = useCallback(async (profilePayload, tokenOverride = authToken) => {
    const token = tokenOverride || ''
    if (!token) return null

    setProfileLoading(true)
    setProfileError('')
    try {
      const payload = await saveUserProfile(profilePayload, token)
      const profile = normalizeProfile(payload)
      setUserProfile(profile)
      return profile
    } catch (error) {
      setProfileError(error.message || 'Failed to save profile')
      throw error
    } finally {
      setProfileLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    let ignore = false

    const checkBackend = async () => {
      try {
        const health = await getApiHealth()
        if (ignore) return
        setBackendHealth({
          status: 'online',
          message: health?.message || 'CDT API running',
        })
      } catch (error) {
        if (ignore) return
        setBackendHealth({
          status: 'offline',
          message: error.message || 'Backend unavailable',
        })
      }
    }

    checkBackend()
    const intervalId = window.setInterval(checkBackend, 25000)

    return () => {
      ignore = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!authToken) {
      setAnalysisHistory([])
      setHistoryError('')
      setUserProfile(null)
      setProfileError('')
      return
    }

    Promise.all([
      refreshHistory(authToken),
      refreshProfile(authToken),
    ]).catch(error => {
      if (error?.status === 401) {
        clearAuthSession()
      }
    })
  }, [authToken, clearAuthSession, refreshHistory, refreshProfile])

  const contextValue = useMemo(() => ({
    analysisResult,
    setAnalysisResult,
    studentInput,
    setStudentInput,
    isAnalyzing,
    setIsAnalyzing,
    authToken,
    currentUser,
    isAuthenticated,
    setAuthSession,
    clearAuthSession,
    analysisHistory,
    refreshHistory,
    historyLoading,
    historyError,
    selectedHistoryId,
    setSelectedHistoryId,
    applyHistoryEntry,
    userProfile,
    profileLoading,
    profileError,
    refreshProfile,
    updateUserProfile,
    backendHealth,
  }), [
    analysisResult,
    studentInput,
    isAnalyzing,
    authToken,
    currentUser,
    isAuthenticated,
    setAuthSession,
    clearAuthSession,
    analysisHistory,
    refreshHistory,
    historyLoading,
    historyError,
    selectedHistoryId,
    applyHistoryEntry,
    userProfile,
    profileLoading,
    profileError,
    refreshProfile,
    updateUserProfile,
    backendHealth,
  ])

  return (
    <CDTContext.Provider value={contextValue}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="login" element={<Login />} />
            <Route
              path="analyze"
              element={(
                <RequireAuth isAuthenticated={isAuthenticated}>
                  <Analyzer />
                </RequireAuth>
              )}
            />
            <Route
              path="results"
              element={(
                <RequireAuth isAuthenticated={isAuthenticated}>
                  <Results />
                </RequireAuth>
              )}
            />
            <Route
              path="whatif"
              element={(
                <RequireAuth isAuthenticated={isAuthenticated}>
                  <WhatIf />
                </RequireAuth>
              )}
            />
            <Route
              path="profile"
              element={(
                <RequireAuth isAuthenticated={isAuthenticated}>
                  <Profile />
                </RequireAuth>
              )}
            />
            <Route
              path="knowledge"
              element={(
                <RequireAuth isAuthenticated={isAuthenticated}>
                  <KnowledgeGraph />
                </RequireAuth>
              )}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CDTContext.Provider>
  )
}
