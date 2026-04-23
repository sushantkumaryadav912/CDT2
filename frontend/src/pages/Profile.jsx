import React, { useEffect, useMemo, useState } from 'react'
import { User, Save, RefreshCw } from 'lucide-react'
import { useCDT } from '../store/CDTContext'
import './Profile.css'

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

const DEFAULT_PROFILE = {
  name: 'Student',
  cgpa: 6.5,
  attendance: 75,
  study_hours_per_week: 24,
  assignment_score: 65,
  exam_score: 62,
  sleep_hours: 6.5,
  extracurricular: 1,
  mental_health_score: 6,
  library_visits: 3,
  online_course_hours: 2,
  peer_study_sessions: 2,
  semester: 4,
  goal: 'Data Scientist',
  resume_text: 'Experienced in Python and Machine Learning with a focus on practical data projects.',
}

const NUMBER_FIELDS = new Set([
  'cgpa',
  'attendance',
  'study_hours_per_week',
  'assignment_score',
  'exam_score',
  'sleep_hours',
  'extracurricular',
  'mental_health_score',
  'library_visits',
  'online_course_hours',
  'peer_study_sessions',
  'semester',
])

function toDisplayName(email) {
  const local = (email || '').split('@')[0] || ''
  if (!local) return 'Student'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function Profile() {
  const {
    currentUser,
    userProfile,
    profileLoading,
    profileError,
    refreshProfile,
    updateUserProfile,
    setStudentInput,
  } = useCDT()

  const [form, setForm] = useState(DEFAULT_PROFILE)
  const [feedback, setFeedback] = useState('')

  const seededDefault = useMemo(() => ({
    ...DEFAULT_PROFILE,
    name: toDisplayName(currentUser?.email),
  }), [currentUser])

  useEffect(() => {
    const persisted = userProfile?.profile
    if (persisted) {
      setForm(prev => ({ ...prev, ...persisted }))
      return
    }
    setForm(seededDefault)
  }, [seededDefault, userProfile])

  const setField = (key, rawValue) => {
    const value = NUMBER_FIELDS.has(key) ? Number(rawValue) : rawValue
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setFeedback('')
    try {
      const saved = await updateUserProfile(form)
      if (saved?.profile) {
        setStudentInput(saved.profile)
      }
      setFeedback('Profile saved to MongoDB and set as active baseline.')
    } catch (error) {
      setFeedback(error.message || 'Failed to save profile.')
    }
  }

  const handleReload = async () => {
    setFeedback('')
    try {
      const loaded = await refreshProfile()
      if (loaded?.profile) {
        setForm(prev => ({ ...prev, ...loaded.profile }))
        setFeedback('Profile reloaded from MongoDB.')
      } else {
        setForm(seededDefault)
        setFeedback('No saved profile yet. Showing default values.')
      }
    } catch (error) {
      setFeedback(error.message || 'Failed to reload profile.')
    }
  }

  return (
    <div className="profile-page animate-fade-in">
      <div className="profile-page__header">
        <div className="page-eyebrow">
          <User size={16} className="text-gold" />
          <span className="section-label">Account Profile</span>
        </div>
        <h1 className="page-title">My Student Profile</h1>
        <p className="page-desc text-secondary">
          Edit your baseline student data once and reuse it across Analyze and What-If simulations.
          All values here are saved to your account in MongoDB.
        </p>
      </div>

      <div className="profile-card card">
        <div className="profile-grid">
          <label className="field">
            <span className="field-label">Student Name</span>
            <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Semester</span>
            <select className="input" value={form.semester} onChange={e => setField('semester', e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(value => <option key={value} value={value}>Semester {value}</option>)}
            </select>
          </label>

          <label className="field field--wide">
            <span className="field-label">Career Goal</span>
            <select className="input" value={form.goal} onChange={e => setField('goal', e.target.value)}>
              {GOALS.map(goal => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field-label">CGPA</span>
            <input className="input" type="number" step="0.1" min="0" max="10" value={form.cgpa} onChange={e => setField('cgpa', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Attendance (%)</span>
            <input className="input" type="number" min="0" max="100" value={form.attendance} onChange={e => setField('attendance', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Study Hours / Week</span>
            <input className="input" type="number" min="0" max="80" value={form.study_hours_per_week} onChange={e => setField('study_hours_per_week', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Assignment Score</span>
            <input className="input" type="number" min="0" max="100" value={form.assignment_score} onChange={e => setField('assignment_score', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Exam Score</span>
            <input className="input" type="number" min="0" max="100" value={form.exam_score} onChange={e => setField('exam_score', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Sleep Hours / Night</span>
            <input className="input" type="number" step="0.5" min="3" max="12" value={form.sleep_hours} onChange={e => setField('sleep_hours', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Mental Health Score</span>
            <input className="input" type="number" step="0.5" min="1" max="10" value={form.mental_health_score} onChange={e => setField('mental_health_score', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Library Visits / Month</span>
            <input className="input" type="number" min="0" max="30" value={form.library_visits} onChange={e => setField('library_visits', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Online Course Hours / Week</span>
            <input className="input" type="number" step="0.5" min="0" max="30" value={form.online_course_hours} onChange={e => setField('online_course_hours', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Peer Study Sessions / Week</span>
            <input className="input" type="number" min="0" max="14" value={form.peer_study_sessions} onChange={e => setField('peer_study_sessions', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Extracurricular (0-2)</span>
            <input className="input" type="number" min="0" max="2" value={form.extracurricular} onChange={e => setField('extracurricular', e.target.value)} />
          </label>

          <label className="field field--full">
            <span className="field-label">Resume Text</span>
            <textarea className="input" rows={5} value={form.resume_text} onChange={e => setField('resume_text', e.target.value)} />
          </label>
        </div>

        <div className="profile-actions">
          <button type="button" className="btn btn-ghost" onClick={handleReload} disabled={profileLoading}>
            <RefreshCw size={14} /> Reload
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={profileLoading}>
            <Save size={14} /> Save Profile
          </button>
        </div>

        {(feedback || profileError) && (
          <p className={`profile-feedback ${profileError ? 'profile-feedback--error' : ''}`}>
            {profileError || feedback}
          </p>
        )}
      </div>
    </div>
  )
}
