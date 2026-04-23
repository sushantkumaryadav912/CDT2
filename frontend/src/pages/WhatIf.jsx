import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { TrendingUp, Zap, SlidersHorizontal } from 'lucide-react'
import { useCDT } from '../store/CDTContext'
import { analyzeMock } from '../utils/mockApi'
import { simulateStudent } from '../utils/api'
import './WhatIf.css'

const PERF_MAP = { 'At-Risk': 0, Average: 1, Good: 2, Excellent: 3 }
const PERF_LABELS = ['At-Risk', 'Average', 'Good', 'Excellent']
const BURN_MAP = { Low: 0, Medium: 1, High: 2 }
const BURN_LABELS = ['Low', 'Medium', 'High']

const PERF_COLORS = ['#e85454', '#f5c842', '#4dd9e0', '#52d68a']
const BURN_COLORS = ['#52d68a', '#f5c842', '#e85454']

const PARAMS = [
  { key: 'study_hours_per_week', label: 'Study Hours / Week', min: 5, max: 65, step: 5, unit: 'h' },
  { key: 'attendance', label: 'Attendance', min: 40, max: 100, step: 5, unit: '%' },
  { key: 'sleep_hours', label: 'Sleep Hours / Night', min: 4, max: 9, step: 0.5, unit: 'h' },
  { key: 'cgpa', label: 'CGPA', min: 2, max: 10, step: 0.5 },
  { key: 'mental_health_score', label: 'Mental Health Score', min: 1, max: 10, step: 0.5 },
]

const MAX_SELECTED_PARAMS = 4

const DEFAULT_STUDENT = {
  name: 'Student', cgpa: 6.5, attendance: 75, study_hours_per_week: 25,
  assignment_score: 65, exam_score: 60, sleep_hours: 6.5, extracurricular: 1,
  mental_health_score: 6, library_visits: 3, online_course_hours: 2, peer_study_sessions: 2,
  semester: 4, goal: 'Data Scientist',
  resume_text: 'Experienced in Python and Machine Learning. SQL and Statistics.',
}

function toDisplayName(email) {
  const local = (email || '').split('@')[0] || ''
  if (!local) return 'Student'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function roundToStep(value, step) {
  const precision = step < 1 ? 2 : 0
  const factor = 1 / step
  return parseFloat((Math.round(value * factor) / factor).toFixed(precision))
}

function formatScenarioValue(value, unit) {
  return `${value}${unit || ''}`
}

function getScenarioSamples(param, baseValue) {
  const spread = Math.max((param.max - param.min) * 0.18, param.step * 2)
  const base = roundToStep(clamp(baseValue, param.min, param.max), param.step)
  const low = roundToStep(clamp(base - spread, param.min, param.max), param.step)
  const high = roundToStep(clamp(base + spread, param.min, param.max), param.step)
  return Array.from(new Set([low, base, high])).sort((left, right) => left - right)
}

function parseCustomValues(text, param, fallbackValue) {
  if (!text?.trim()) {
    return getScenarioSamples(param, fallbackValue)
  }

  const values = text
    .split(',')
    .map(item => Number(item.trim()))
    .filter(value => Number.isFinite(value))
    .map(value => roundToStep(clamp(value, param.min, param.max), param.step))

  const unique = Array.from(new Set(values)).sort((a, b) => a - b)
  return unique.length > 0 ? unique : getScenarioSamples(param, fallbackValue)
}

function buildScenarios(base, params, sampleByParam) {
  if (params.length === 0) return []

  const combos = params.reduce((acc, param) => {
    const samples = sampleByParam[param.key] || getScenarioSamples(param, base[param.key])
    const next = []
    acc.forEach(existing => {
      samples.forEach(value => {
        next.push({
          values: { ...existing.values, [param.key]: value },
          parts: [...existing.parts, `${param.label}: ${formatScenarioValue(value, param.unit)}`],
        })
      })
    })
    return next
  }, [{ values: {}, parts: [] }])

  return combos.map((combo, index) => ({
    id: combo.parts.join(' | ') || `scenario-${index}`,
    label: combo.parts.join(' • '),
    values: combo.values,
    index,
  }))
}

function summarizeScenario(result, scenario) {
  const performanceLabel = result?.ml?.performance_prediction || 'Average'
  const burnoutLabel = result?.ml?.burnout_prediction || 'Low'
  const passProb = Number(result?.ml?.pass_probability ?? 0)
  const burnoutProbabilities = result?.ml?.burnout_probabilities || {}
  const weightedBurnout =
    (Number(burnoutProbabilities.Low) || 0) * (BURN_MAP.Low ?? 0)
    + (Number(burnoutProbabilities.Medium) || 0) * (BURN_MAP.Medium ?? 1)
    + (Number(burnoutProbabilities.High) || 0) * (BURN_MAP.High ?? 2)
  const burnoutScore = Number.isFinite(weightedBurnout)
    ? parseFloat(weightedBurnout.toFixed(3))
    : (BURN_MAP[burnoutLabel] ?? 0)

  return {
    id: scenario.id,
    label: scenario.label,
    values: scenario.values,
    perf: PERF_MAP[performanceLabel] ?? 1,
    perfLabel: performanceLabel,
    burn: burnoutScore,
    burnLabel: burnoutLabel,
    passProb: parseFloat((passProb * 100).toFixed(1)),
  }
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <strong>{
              p.name === 'Burnout'
                ? `${BURN_LABELS[Math.round(p.value)] || p.value} (${Number(p.value).toFixed(2)})`
                : (PERF_LABELS[p.value] || p.value)
            }</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function WhatIf() {
  const { studentInput, authToken, isAuthenticated, userProfile, currentUser } = useCDT()
  const fallbackStudent = useMemo(() => ({
    ...DEFAULT_STUDENT,
    name: toDisplayName(currentUser?.email),
  }), [currentUser])
  const base = studentInput || userProfile?.profile || fallbackStudent
  const [selectedParams, setSelectedParams] = useState([PARAMS[0].key, PARAMS[1].key])
  const [useCustomValues, setUseCustomValues] = useState(false)
  const [customValueTextByParam, setCustomValueTextByParam] = useState({})
  const [simData, setSimData] = useState([])
  const [isSimLoading, setIsSimLoading] = useState(false)
  const [simError, setSimError] = useState('')
  const [simEngine, setSimEngine] = useState('mock')
  const selectedParamDefs = useMemo(
    () => PARAMS.filter(param => selectedParams.includes(param.key)),
    [selectedParams],
  )

  useEffect(() => {
    setCustomValueTextByParam(prev => {
      const next = { ...prev }
      selectedParamDefs.forEach(param => {
        if (!next[param.key]) {
          const baselineValue = roundToStep(clamp(base[param.key], param.min, param.max), param.step)
          next[param.key] = `${baselineValue}`
        }
      })
      return next
    })
  }, [base, selectedParamDefs])

  const sampleByParam = useMemo(() => {
    return selectedParamDefs.reduce((acc, param) => {
      const text = customValueTextByParam[param.key] || ''
      acc[param.key] = useCustomValues
        ? parseCustomValues(text, param, base[param.key])
        : getScenarioSamples(param, base[param.key])
      return acc
    }, {})
  }, [base, customValueTextByParam, selectedParamDefs, useCustomValues])

  const scenarioPlan = useMemo(
    () => buildScenarios(base, selectedParamDefs, sampleByParam),
    [base, sampleByParam, selectedParamDefs],
  )

  const baselineScenario = useMemo(() => {
    if (scenarioPlan.length === 0) return null
    return scenarioPlan.find(scenario => selectedParamDefs.every(param => scenario.values[param.key] === base[param.key])) || scenarioPlan[0]
  }, [base, scenarioPlan, selectedParamDefs])

  const toggleParam = (key) => {
    setSelectedParams(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter(item => item !== key)
      }
      if (prev.length >= MAX_SELECTED_PARAMS) return prev
      return [...prev, key]
    })
  }

  useEffect(() => {
    let ignore = false

    const buildWithMock = () => {
      const next = scenarioPlan.map(scenario => summarizeScenario(analyzeMock({ ...base, ...scenario.values }), scenario))
      if (!ignore) {
        setSimData(next)
        setSimEngine('mock')
      }
    }

    const runSimulation = async () => {
      setIsSimLoading(true)
      setSimError('')

      if (!isAuthenticated || !authToken) {
        buildWithMock()
        if (!ignore) {
          setIsSimLoading(false)
        }
        return
      }

      try {
        const results = await Promise.all(
          scenarioPlan.map(scenario => simulateStudent({ ...base, ...scenario.values }, authToken))
        )
        if (ignore) return
        setSimData(results.map((result, index) => summarizeScenario(result, scenarioPlan[index])))
        setSimEngine('backend')
      } catch (error) {
        if (ignore) return
        buildWithMock()
        setSimError(`Backend simulation failed (${error.message}). Showing local approximation.`)
      } finally {
        if (!ignore) {
          setIsSimLoading(false)
        }
      }
    }

    runSimulation()

    return () => {
      ignore = true
    }
  }, [authToken, base, isAuthenticated, scenarioPlan])

  useEffect(() => {
    if (selectedParams.length > 0) return
    setSelectedParams([PARAMS[0].key])
  }, [selectedParams])

  const currentPoint = simData.find(point => point.id === baselineScenario?.id) || simData[0]

  return (
    <div className="whatif animate-fade-in">
      <div className="whatif__header">
        <div className="page-eyebrow">
          <SlidersHorizontal size={16} className="text-gold" />
          <span className="section-label">Simulation Module</span>
        </div>
        <h1 className="page-title">Multi-Parameter What-If Simulator</h1>
        <p className="page-desc text-secondary">
          Select multiple student parameters and compare how their combined variations change the model predictions.
          Each selected parameter expands into a small low, base, and high band so you can see interactions instead of a single-axis sweep.
          Based on{' '}
          <span className="text-gold">{base.name}</span>'s profile.
        </p>
        <div className="sim-mode-row">
          <span className={`badge ${simEngine === 'backend' ? 'badge-green' : 'badge-gold'}`}>
            {simEngine === 'backend' ? 'Backend Simulation' : 'Local Simulation'}
          </span>
          {isSimLoading && <span className="sim-mode-status text-muted mono-font">Recomputing scenarios...</span>}
          <span className="sim-mode-status text-muted mono-font">
            {selectedParams.length} selected · {scenarioPlan.length} combinations
          </span>
        </div>
        {simError && <p className="sim-mode-error">{simError}</p>}
      </div>

      <div className="param-selector card">
        <div className="param-selector__head">
          <div>
            <p className="section-label">Select Parameters</p>
            <p className="param-selector__hint text-muted">Pick up to four parameters. The comparison rail stays horizontal so the layout does not jump.</p>
          </div>
          <span className="badge badge-cyan">{selectedParams.length} active</span>
        </div>
        <div className="param-rail">
          {PARAMS.map(p => (
            <button
              key={p.key}
              type="button"
              className={`param-btn ${selectedParams.includes(p.key) ? 'param-btn--active' : ''}`}
              onClick={() => toggleParam(p.key)}
            >
              <span className="param-btn__label">{p.label}</span>
              <span className="param-btn__current mono-font">{base[p.key]}{p.unit || ''}</span>
            </button>
          ))}
        </div>

        <div className="param-mode-row">
          <button
            type="button"
            className={`mode-btn ${!useCustomValues ? 'mode-btn--active' : ''}`}
            onClick={() => setUseCustomValues(false)}
          >
            Auto sample values
          </button>
          <button
            type="button"
            className={`mode-btn ${useCustomValues ? 'mode-btn--active' : ''}`}
            onClick={() => setUseCustomValues(true)}
          >
            Custom values per parameter
          </button>
        </div>

        {useCustomValues && (
          <div className="custom-values-grid">
            {selectedParamDefs.map(param => (
              <div key={param.key} className="custom-values-card">
                <div className="custom-values-title">{param.label}</div>
                <input
                  className="custom-values-input"
                  value={customValueTextByParam[param.key] || ''}
                  onChange={e => setCustomValueTextByParam(prev => ({ ...prev, [param.key]: e.target.value }))}
                  placeholder={getScenarioSamples(param, base[param.key]).join(', ')}
                />
                <div className="custom-values-hint text-muted">
                  Using: {(sampleByParam[param.key] || []).map(value => formatScenarioValue(value, param.unit)).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="snapshot-row">
        <div className="snapshot-card card">
          <p className="section-label">Current Profile</p>
          <div className="snapshot-vals">
            <div>
              <div className="snapshot-big">{base.name}</div>
              <div className="snapshot-sub text-muted">Baseline student</div>
            </div>
            <div>
              <div className="snapshot-big text-gold">{selectedParams.length}</div>
              <div className="snapshot-sub text-muted">Parameters selected</div>
            </div>
            <div>
              <div className="snapshot-big text-cyan">{scenarioPlan.length}</div>
              <div className="snapshot-sub text-muted">Scenario combinations</div>
            </div>
            <div>
              <div className="snapshot-big" style={{ color: PERF_COLORS[currentPoint?.perf ?? 1] }}>
                {currentPoint?.perfLabel || 'Average'}
              </div>
              <div className="snapshot-sub text-muted">Baseline performance</div>
            </div>
            <div>
              <div className="snapshot-big" style={{ color: BURN_COLORS[currentPoint?.burn ?? 0] }}>
                {currentPoint?.burnLabel || 'Low'}
              </div>
              <div className="snapshot-sub text-muted">Baseline burnout</div>
            </div>
            <div>
              <div className="snapshot-big text-cyan">{Math.round(currentPoint?.passProb ?? 0)}%</div>
              <div className="snapshot-sub text-muted">Baseline pass probability</div>
            </div>
          </div>
          <div className="snapshot-bands">
            {selectedParamDefs.map(param => {
              const samples = sampleByParam[param.key] || getScenarioSamples(param, base[param.key])
              return (
                <div key={param.key} className="snapshot-band">
                  <div className="snapshot-band__label">{param.label}</div>
                  <div className="snapshot-band__chips">
                    {samples.map(value => (
                      <span key={value} className="snapshot-band__chip">
                        {formatScenarioValue(value, param.unit)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="whatif-charts">
        <div className="card">
          <div className="chart-header">
            <p className="section-label">Performance vs selected scenarios</p>
            <TrendingUp size={14} className="text-cyan" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={simData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#9098b0', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis
                tick={{ fill: '#9098b0', fontSize: 10 }}
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickFormatter={v => PERF_LABELS[v] || v}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="perf"
                stroke="#f5c842"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  return <circle key={cx} cx={cx} cy={cy} r={5} fill={PERF_COLORS[payload.perf]} stroke="var(--bg-deep)" strokeWidth={2} />
                }}
                name="Performance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="chart-header">
            <p className="section-label">Burnout Risk vs selected scenarios</p>
            <Zap size={14} className="text-red" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={simData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#9098b0', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis
                tick={{ fill: '#9098b0', fontSize: 10 }}
                domain={[0, 2]}
                ticks={[0, 1, 2]}
                tickFormatter={v => BURN_LABELS[v] || v}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="burn"
                stroke="#e85454"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  return <circle key={cx} cx={cx} cy={cy} r={5} fill={BURN_COLORS[payload.burn]} stroke="var(--bg-deep)" strokeWidth={2} />
                }}
                name="Burnout"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="chart-header">
            <p className="section-label">Pass Probability vs selected scenarios</p>
            <TrendingUp size={14} className="text-green" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={simData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#9098b0', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tick={{ fill: '#9098b0', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, 'Pass Probability']} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)', fontSize: 12 }} />
              <Bar dataKey="passProb" radius={[4, 4, 0, 0]} name="Pass Prob">
                {simData.map((d, i) => (
                  <Cell key={d.id || i} fill={d.passProb >= 60 ? '#52d68a' : d.passProb >= 40 ? '#f5c842' : '#e85454'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="card insights-card">
        <p className="section-label">Simulation Insights</p>
        {simData.length === 0 ? (
          <p className="text-secondary" style={{ fontSize: 13 }}>Simulation data is loading...</p>
        ) : (
          <div className="insights-grid">
            <div className="insight">
              <div className="insight-icon text-gold">📈</div>
              <div>
                <div className="insight-title">Best Scenario</div>
                <div className="insight-desc text-secondary">
                  {(() => {
                    const bestPerf = simData.reduce((best, d) => d.perf > best.perf ? d : best, simData[0])
                    return `Highest performance at ${bestPerf.label} — predicted ${bestPerf.perfLabel}`
                  })()}
                </div>
              </div>
            </div>
            <div className="insight">
              <div className="insight-icon text-green">🛡️</div>
              <div>
                <div className="insight-title">Safest Combination</div>
                <div className="insight-desc text-secondary">
                  {(() => {
                    const safest = simData.reduce((best, d) => d.burn < best.burn ? d : best, simData[0])
                    return `Lowest burnout at ${safest.label} — risk ${safest.burnLabel}`
                  })()}
                </div>
              </div>
            </div>
            <div className="insight">
              <div className="insight-icon text-cyan">🎯</div>
              <div>
                <div className="insight-title">Sweet Spot</div>
                <div className="insight-desc text-secondary">
                  {(() => {
                    const balanced = simData.reduce((best, d) => {
                      const score = d.perf * 2 - d.burn
                      const bestScore = best.perf * 2 - best.burn
                      return score > bestScore ? d : best
                    }, simData[0])
                    return `Best balance at ${balanced.label} — ${balanced.perfLabel} performance, ${balanced.burnLabel} burnout`
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
