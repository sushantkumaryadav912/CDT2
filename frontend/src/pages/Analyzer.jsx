import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, User, BookOpen, Heart, Target, Loader2, Sparkles, Clock3 } from 'lucide-react'
import { useCDT } from '../store/CDTContext'
import { analyzeStudent } from '../utils/api'
import './Analyzer.css'

const GOALS = [
  'Data Scientist',
  'ML Engineer',
  'AI Researcher',
  'Software Engineer',
  'Data Analyst',
  'Backend Developer',
  'Frontend Developer',
  'Full Stack Developer',
  'DevOps Engineer',
  'MLOps Engineer',
  'AI Engineer',
  'Data Engineer',
  'QA Engineer',
  'BI Analyst',
  'Engineering Manager',
  'Software Architect',
  'Developer Advocate',
]

const DEFAULT = {
  name: 'Student Alpha',
  cgpa: 6.5,
  attendance: 78,
  study_hours_per_week: 25,
  assignment_score: 65,
  exam_score: 60,
  sleep_hours: 6.5,
  extracurricular: 1,
  mental_health_score: 6.0,
  library_visits: 3,
  online_course_hours: 2.0,
  peer_study_sessions: 2,
  semester: 4,
  goal: 'Data Scientist',
  resume_text: 'Experienced in Python and Machine Learning. Worked on projects involving SQL and Statistics. Interested in Deep Learning and NLP. Strong background in Data Analysis and Research.',
}

function formatHistoryDate(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDisplayName(value) {
  if (!value) return 'Student'
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getProfileSnapshot(entry, fallbackName) {
  const input = entry?.input || entry?.result?.input || {}
  return {
    name: input?.name || entry?.result?.student || fallbackName || 'Student',
    goal: input?.goal || entry?.result?.career || 'Data Scientist',
    semester: input?.semester ?? 4,
    values: input,
  }
}

function SliderField({ label, name, min, max, step = 1, value, onChange, unit = '' }) {
  return (
    <div className="slider-wrap">
      <div className="slider-label">
        <span className="slider-name">{label}</span>
        <span className="slider-value">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(name, parseFloat(e.target.value))}
      />
      <div className="slider-minmax">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default function Analyzer() {
  const [form, setForm] = useState(DEFAULT)
  const [runFeedback, setRunFeedback] = useState('')
  const [lastEngine, setLastEngine] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')

  const {
    setAnalysisResult,
    setStudentInput,
    setIsAnalyzing,
    isAnalyzing,
    authToken,
    clearAuthSession,
    analysisHistory,
    refreshHistory,
    historyLoading,
    historyError,
    selectedHistoryId,
    setSelectedHistoryId,
    applyHistoryEntry,
    currentUser,
    userProfile,
  } = useCDT()
  const navigate = useNavigate()

  const currentUserName = useMemo(() => {
    const email = currentUser?.email || ''
    const localPart = email.split('@')[0] || ''
    return toDisplayName(localPart)
  }, [currentUser])

  const profileOptions = useMemo(() => {
    const fallbackName = currentUserName || DEFAULT.name
    const options = analysisHistory.slice(0, 6).map(entry => ({
      id: entry.id,
      source: 'history',
      created_at: entry.created_at,
      ...getProfileSnapshot(entry, fallbackName),
    }))

    const persistedProfile = userProfile?.profile
    if (persistedProfile) {
      options.unshift({
        id: userProfile.id || 'saved-profile',
        source: 'profile',
        name: persistedProfile.name || fallbackName,
        goal: persistedProfile.goal || DEFAULT.goal,
        semester: persistedProfile.semester || DEFAULT.semester,
        values: persistedProfile,
      })
    }

    if (options.length === 0 && currentUser) {
      options.push({
        id: 'current-account',
        source: 'account',
        name: currentUserName || DEFAULT.name,
        goal: DEFAULT.goal,
        semester: DEFAULT.semester,
        values: { ...DEFAULT, name: currentUserName || DEFAULT.name },
      })
    }

    return options
  }, [analysisHistory, currentUser, currentUserName, userProfile])

  const handleChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const applyProfile = (profile) => {
    if (!profile) return
    setSelectedProfileId(profile.id)
    setForm(prev => ({
      ...prev,
      ...DEFAULT,
      ...profile.values,
      name: profile.name || prev.name,
      goal: profile.goal || prev.goal,
      semester: profile.semester || prev.semester,
    }))
    setRunFeedback(`Loaded ${profile.name}'s profile from your account history.`)
  }

  useEffect(() => {
    if (selectedProfileId) return
    if (profileOptions.length === 0) {
      if (currentUserName && form.name === DEFAULT.name) {
        setForm(prev => ({ ...prev, name: currentUserName }))
      }
      return
    }

    const preferredProfile = profileOptions[0]
    if (preferredProfile) {
      applyProfile(preferredProfile)
    }
  }, [currentUserName, form.name, profileOptions, selectedProfileId])

  const handleLoadFromHistory = (entry) => {
    applyHistoryEntry(entry)
    setRunFeedback('Loaded a previous backend analysis from history.')
    navigate('/results')
  }

  const handleSubmit = async () => {
    if (!authToken) {
      navigate('/login', {
        replace: true,
        state: { from: '/analyze' },
      })
      return
    }

    setIsAnalyzing(true)
    setRunFeedback('')
    setStudentInput(form)
    setSelectedHistoryId('')

    try {
      const result = await analyzeStudent(form, authToken)
      try {
        await refreshHistory(authToken)
      } catch (historyLoadError) {
        setRunFeedback(`Analysis completed, but history refresh failed (${historyLoadError.message}).`)
      }

      setLastEngine('backend')
      setAnalysisResult(result)
      navigate('/results')
    } catch (error) {
      if (error?.status === 401) {
        clearAuthSession()
        navigate('/login', {
          replace: true,
          state: { from: '/analyze' },
        })
        setRunFeedback('Session expired. Please sign in again.')
      } else {
        setRunFeedback(error?.message || 'Backend analysis failed. Please retry.')
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="analyzer animate-fade-in">
      {/* Header */}
      <div className="analyzer__header">
        <div className="page-eyebrow">
          <FlaskConical size={16} className="text-gold" />
          <span className="section-label">Input Module</span>
        </div>
        <h1 className="page-title">Student Profile Setup</h1>
        <p className="page-desc text-secondary">
          Enter your academic metrics to generate a full Cognitive Digital Twin analysis across all 6 AI modules.
          This page runs protected backend inference and saves analysis history.
        </p>
        {currentUser && (
          <p className="page-user-note text-muted mono-font">
            Signed in as {currentUser.email}. This view only shows your own saved analyses and profiles.
          </p>
        )}
      </div>

      <div className="history-panel card animate-fade-up delay-2">
          <div className="history-panel__head">
            <p className="section-label">Your Backend Runs</p>
            <span className="badge badge-cyan">{analysisHistory.length} saved</span>
          </div>

          {historyLoading ? (
            <p className="history-message text-muted mono-font">Loading history...</p>
          ) : historyError ? (
            <p className="history-message history-message--error">{historyError}</p>
          ) : analysisHistory.length === 0 ? (
            <p className="history-message text-muted">No saved analyses yet. Run one now to populate history.</p>
          ) : (
            <div className="history-list">
              {analysisHistory.slice(0, 5).map(entry => (
                <button
                  key={entry.id}
                  className={`history-item ${selectedHistoryId === entry.id ? 'history-item--active' : ''}`}
                  onClick={() => handleLoadFromHistory(entry)}
                >
                  <div className="history-item__top">
                    <span className="history-item__name">{entry?.input?.name || entry?.result?.student || 'Student'}</span>
                    <span className="history-item__time"><Clock3 size={12} /> {formatHistoryDate(entry.created_at)}</span>
                  </div>
                  <div className="history-item__meta">
                    <span>{entry?.input?.goal || entry?.result?.career || 'Goal N/A'}</span>
                    <span>Perf: {entry?.result?.ml?.performance_prediction || 'N/A'}</span>
                    <span>Burnout: {entry?.result?.ml?.burnout_prediction || 'N/A'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>

      <div className="analyzer__body">
        {/* Left: Form sections */}
        <div className="form-sections">
          {/* Identity */}
          <div className="form-section card animate-fade-up delay-1">
            <div className="form-section__header">
              <User size={16} className="text-cyan" />
              <h2 className="form-section__title">Identity</h2>
            </div>
            {profileOptions.length > 0 && (
              <div className="profile-rail">
                <div className="profile-rail__header">
                  <div>
                    <p className="section-label">Auto-selected Profiles</p>
                    <p className="profile-rail__hint text-muted">Choose one of your own saved student profiles without stretching the layout.</p>
                  </div>
                  <span className="badge badge-gold">{profileOptions.length} profiles</span>
                </div>
                <div className="profile-rail__list">
                  {profileOptions.map(profile => (
                    <button
                      key={profile.id}
                      type="button"
                      className={`profile-chip ${selectedProfileId === profile.id ? 'profile-chip--active' : ''}`}
                      onClick={() => applyProfile(profile)}
                    >
                      <span className="profile-chip__name">{profile.name}</span>
                      <span className="profile-chip__goal">{profile.goal}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="form-grid-2">
              <div className="field">
                <label className="field-label" htmlFor="student-name">Student Name</label>
                <input
                  id="student-name"
                  className="input"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="Enter name"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="semester">Semester</label>
                <select id="semester" className="input" value={form.semester} onChange={e => handleChange('semester', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="extracurricular">Extracurricular</label>
                <select id="extracurricular" className="input" value={form.extracurricular} onChange={e => handleChange('extracurricular', parseInt(e.target.value))}>
                  <option value={0}>None</option>
                  <option value={1}>Some Activities</option>
                  <option value={2}>Heavy Involvement</option>
                </select>
              </div>
            </div>
            <div className="goal-rail-wrap">
              <div className="goal-rail__head">
                <span className="field-label">Career Goal</span>
                <span className="goal-rail__note text-muted">Sliding options keep the panel compact.</span>
              </div>
              <div className="goal-rail" role="listbox" aria-label="Career goals">
                {GOALS.map(goal => (
                  <button
                    key={goal}
                    type="button"
                    className={`goal-pill ${form.goal === goal ? 'goal-pill--active' : ''}`}
                    onClick={() => handleChange('goal', goal)}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Academic */}
          <div className="form-section card animate-fade-up delay-2">
            <div className="form-section__header">
              <BookOpen size={16} className="text-gold" />
              <h2 className="form-section__title">Academic Metrics</h2>
            </div>
            <div className="sliders-grid">
              <SliderField label="CGPA" name="cgpa" min={2} max={10} step={0.1} value={form.cgpa} onChange={handleChange} />
              <SliderField label="Attendance" name="attendance" min={20} max={100} value={form.attendance} onChange={handleChange} unit="%" />
              <SliderField label="Study Hours / Week" name="study_hours_per_week" min={1} max={70} value={form.study_hours_per_week} onChange={handleChange} unit="h" />
              <SliderField label="Assignment Score" name="assignment_score" min={0} max={100} value={form.assignment_score} onChange={handleChange} />
              <SliderField label="Exam Score" name="exam_score" min={0} max={100} value={form.exam_score} onChange={handleChange} />
              <SliderField label="Library Visits / Month" name="library_visits" min={0} max={20} value={form.library_visits} onChange={handleChange} />
              <SliderField label="Online Course Hours / Week" name="online_course_hours" min={0} max={20} step={0.5} value={form.online_course_hours} onChange={handleChange} unit="h" />
              <SliderField label="Peer Study Sessions / Week" name="peer_study_sessions" min={0} max={10} value={form.peer_study_sessions} onChange={handleChange} />
            </div>
          </div>

          {/* Wellbeing */}
          <div className="form-section card animate-fade-up delay-3">
            <div className="form-section__header">
              <Heart size={16} className="text-red" />
              <h2 className="form-section__title">Wellbeing</h2>
            </div>
            <div className="sliders-grid">
              <SliderField label="Sleep Hours / Night" name="sleep_hours" min={3} max={10} step={0.5} value={form.sleep_hours} onChange={handleChange} unit="h" />
              <SliderField label="Mental Health Score" name="mental_health_score" min={1} max={10} step={0.5} value={form.mental_health_score} onChange={handleChange} />
            </div>
          </div>

          {/* Resume */}
          <div className="form-section card animate-fade-up delay-4">
            <div className="form-section__header">
              <Target size={16} className="text-purple" />
              <h2 className="form-section__title">Resume Text <span className="text-muted" style={{fontWeight:400, fontSize:12}}>(for NLP skill extraction)</span></h2>
            </div>
            <textarea
              className="input"
              rows={5}
              value={form.resume_text}
              onChange={e => handleChange('resume_text', e.target.value)}
              placeholder="Describe your skills, experience, and interests..."
            />
            <p className="field-hint text-muted">
              The NLP module will extract skills, run POS tagging, TF-IDF analysis, and N-gram extraction from this text.
            </p>
          </div>
        </div>

        {/* Right: Preview panel */}
        <div className="preview-panel animate-fade-up delay-2">
          <div className="preview-card card">
            <p className="section-label">Live Preview</p>
            <h3 className="preview-name">{form.name || 'Student'}</h3>
            <p className="text-muted preview-goal">→ {form.goal}</p>

            <div className="divider" />

            <div className="preview-metrics">
              {[
                { label: 'CGPA', value: form.cgpa, max: 10, color: form.cgpa >= 7 ? 'green' : form.cgpa >= 5 ? 'gold' : 'red' },
                { label: 'Attendance', value: form.attendance, max: 100, unit: '%', color: form.attendance >= 75 ? 'green' : form.attendance >= 60 ? 'gold' : 'red' },
                { label: 'Exam Score', value: form.exam_score, max: 100, color: form.exam_score >= 60 ? 'green' : form.exam_score >= 40 ? 'gold' : 'red' },
                { label: 'Study Hrs/Wk', value: form.study_hours_per_week, max: 70, unit: 'h', color: 'cyan' },
                { label: 'Sleep Hrs', value: form.sleep_hours, max: 10, unit: 'h', color: form.sleep_hours >= 6 ? 'green' : 'red' },
                { label: 'Mental Health', value: form.mental_health_score, max: 10, color: form.mental_health_score >= 6 ? 'green' : form.mental_health_score >= 4 ? 'gold' : 'red' },
              ].map(m => (
                <div key={m.label} className="preview-metric">
                  <div className="preview-metric__row">
                    <span className="preview-metric__label">{m.label}</span>
                    <span className={`preview-metric__val text-${m.color}`}>
                      {m.value}{m.unit || ''}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill bg-${m.color}`}
                      style={{ width: `${(m.value / m.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="preview-status">
              <p className="section-label">Quick Assessment</p>
              {form.cgpa < 5 && <div className="alert-chip alert-chip--red">⚠ Critical CGPA</div>}
              {form.attendance < 75 && <div className="alert-chip alert-chip--orange">⚠ Low Attendance</div>}
              {form.sleep_hours < 5 && <div className="alert-chip alert-chip--orange">⚠ Sleep Deprived</div>}
              {form.mental_health_score < 4 && <div className="alert-chip alert-chip--red">⚠ Mental Health Risk</div>}
              {form.study_hours_per_week > 55 && form.sleep_hours < 5.5 && <div className="alert-chip alert-chip--red">⚠ Burnout Risk</div>}
              {form.cgpa >= 7 && form.attendance >= 80 && <div className="alert-chip alert-chip--green">✓ On Track</div>}
              {form.cgpa >= 8 && <div className="alert-chip alert-chip--green">✓ Excellence Track</div>}
            </div>

            <button
              className="btn btn-primary analyze-btn"
              onClick={handleSubmit}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <><Loader2 size={16} className="spin" /> Analyzing...</>
              ) : (
                <><Sparkles size={16} /> Run CDT Analysis</>
              )}
            </button>

            {lastEngine && (
              <p className="engine-note text-muted mono-font">
                Last run engine: {lastEngine === 'backend' ? 'Backend API (Mongo + JWT)' : 'Unavailable'}
              </p>
            )}
            {runFeedback && <p className="engine-note text-secondary">{runFeedback}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
