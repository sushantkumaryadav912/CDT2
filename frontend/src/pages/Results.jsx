import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie
} from 'recharts'
import { useCDT } from '../store/CDTContext'
import {
  Brain, BookOpen, Network, GitBranch, Shield, Activity,
  ChevronRight, AlertTriangle, CheckCircle, Info, ArrowLeft,
  Zap, Target, TrendingUp, TrendingDown
} from 'lucide-react'
import './Results.css'

const PERF_COLORS = { Excellent: '#52d68a', Good: '#4dd9e0', Average: '#f5c842', 'At-Risk': '#e85454' }
const BURN_COLORS = { Low: '#52d68a', Medium: '#f5c842', High: '#e85454' }

function TabButton({ active, onClick, children }) {
  return (
    <button className={`tab-btn ${active ? 'tab-btn--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Results() {
  const { analysisResult, studentInput } = useCDT()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('ml')

  if (!analysisResult) {
    return (
      <div className="results-empty animate-fade-in">
        <Brain size={48} className="text-muted" />
        <h2>No Analysis Available</h2>
        <p className="text-secondary">Run a student analysis first to see results here.</p>
        <button className="btn btn-primary" onClick={() => navigate('/analyze')}>
          Go to Analyzer
        </button>
      </div>
    )
  }

  const r = analysisResult
  const input = r?.input || {}
  const ml = r?.ml || {}
  const nlp = r?.nlp || {}
  const expert = r?.expert || {}
  const roadmap = r?.roadmap || {}
  const fol = r?.fol || {}
  const agent = r?.agent || {}
  const knowledgeGraph = r?.knowledge_graph || {}

  const perfProbabilities = ml?.performance_probabilities || {}
  const burnoutProbabilities = ml?.burnout_probabilities || {}
  const extractedSkills = Array.isArray(nlp?.extracted_skills) ? nlp.extracted_skills : []
  const skillGaps = Array.isArray(knowledgeGraph?.skill_gaps) ? knowledgeGraph.skill_gaps : []
  const careerRequiredSkills = Array.isArray(knowledgeGraph?.career_required_skills) ? knowledgeGraph.career_required_skills : []
  const studentSkills = Array.isArray(knowledgeGraph?.student_has) ? knowledgeGraph.student_has : []
  const expertRules = Array.isArray(expert?.rules) ? expert.rules : []
  const folConclusions = Array.isArray(fol?.conclusions) ? fol.conclusions : []
  const roadmapPath = Array.isArray(roadmap?.path) ? roadmap.path : []
  const agentWeeks = Array.isArray(agent?.weeks) ? agent.weeks : []

  const perfData = Object.entries(perfProbabilities).map(([name, value]) => ({ name, value }))
  const burnData = Object.entries(burnoutProbabilities).map(([name, value]) => ({ name, value }))

  const radarData = [
    { subject: 'CGPA', value: ((input?.cgpa ?? 0) / 10) * 100 },
    { subject: 'Attendance', value: input?.attendance ?? 0 },
    { subject: 'Exam Score', value: input?.exam_score ?? 0 },
    { subject: 'Assignment', value: input?.assignment_score ?? 0 },
    { subject: 'Sleep', value: ((input?.sleep_hours ?? 0) / 10) * 100 },
    { subject: 'Mental Health', value: (input?.mental_health_score ?? 0) * 10 },
    { subject: 'Study Hours', value: Math.min(((input?.study_hours_per_week ?? 0) / 50) * 100, 100) },
  ]

  const agentData = agentWeeks.map(w => ({
    week: `W${w.week}`,
    grade: parseFloat((((w?.grade ?? w?.observation?.actual_grade ?? 0) * 100)).toFixed(1)),
    attendance: parseFloat((w?.attendance ?? w?.observation?.attendance ?? 0).toFixed(1)),
    alerts: Array.isArray(w?.alerts) ? w.alerts.length : 0,
  }))

  const tfidfData = (nlp?.bow_tfidf || []).map(item => ({
    word: item.word,
    bow: item.bow,
    tfidf: parseFloat((item.tfidf).toFixed(4)),
  }))

  const perfColor = PERF_COLORS[ml?.performance_prediction] || '#f5c842'
  const burnColor = BURN_COLORS[ml?.burnout_prediction] || '#f5c842'

  const TABS = [
    { key: 'ml', label: 'ML Predictions', icon: Brain },
    { key: 'nlp', label: 'NLP Analysis', icon: BookOpen },
    { key: 'expert', label: 'Expert System', icon: Shield },
    { key: 'roadmap', label: 'A* Roadmap', icon: GitBranch },
    { key: 'fol', label: 'FOL Reasoning', icon: Network },
    { key: 'agent', label: 'Agent Monitor', icon: Activity },
  ]

  return (
    <div className="results animate-fade-in">
      {/* Header */}
      <div className="results__header">
        <button className="btn btn-ghost back-btn" onClick={() => navigate('/analyze')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="header-info">
          <p className="section-label">CDT Analysis Report</p>
          <h1 className="page-title">{r.student}</h1>
          <div className="header-badges">
            <span className="badge badge-gold"><Zap size={10} /> {input?.goal || studentInput?.goal || 'Student Goal'}</span>
            <span className="badge badge-cyan">Sem {input?.semester ?? studentInput?.semester ?? '-'}</span>
            <span className="badge" style={{ background: `${perfColor}18`, color: perfColor, border: `1px solid ${perfColor}30` }}>
              {ml?.performance_prediction || 'Average'}
            </span>
            <span className="badge" style={{ background: `${burnColor}18`, color: burnColor, border: `1px solid ${burnColor}30` }}>
              Burnout: {ml?.burnout_prediction || 'Low'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="summary-row">
        {[
          { label: 'Pass Probability', value: `${(((ml?.pass_probability ?? 0) * 100)).toFixed(1)}%`, color: (ml?.pass_probability ?? 0) > 0.6 ? 'green' : 'red' },
          { label: 'Expert Rules Fired', value: expert?.rules_fired ?? 0, color: 'gold' },
          { label: 'Skills Detected', value: extractedSkills.length, color: 'cyan' },
          { label: 'Roadmap Steps', value: roadmap?.steps ?? roadmapPath.length, color: 'purple' },
          { label: 'FOL Conclusions', value: fol?.rules_fired ?? folConclusions.length, color: 'gold' },
          { label: 'Skill Gaps', value: skillGaps.length, color: skillGaps.length === 0 ? 'green' : 'red' },
        ].map((s, i) => (
          <div key={s.label} className={`summary-card animate-fade-up delay-${i + 1}`}>
            <div className={`summary-val text-${s.color} mono-font`}>{s.value}</div>
            <div className="summary-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Radar + profile overview */}
      <div className="overview-row">
        <div className="card radar-card">
          <p className="section-label">Student Profile Radar</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9098b0', fontSize: 11 }} />
              <Radar name="Student" dataKey="value" stroke="#f5c842" fill="#f5c842" fillOpacity={0.15} strokeWidth={2} dot={{ r: 4, fill: '#f5c842' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card perf-overview">
          <p className="section-label">Performance Prediction</p>
          <div className="perf-big">
            <div className="perf-label" style={{ color: perfColor }}>{ml?.performance_prediction || 'Average'}</div>
            <div className="perf-sub text-muted mono-font">PREDICTED CLASS</div>
          </div>
          <div className="prob-bars">
            {Object.entries(perfProbabilities).map(([cls, prob]) => (
              <div key={cls} className="prob-row">
                <span className="prob-label">{cls}</span>
                <div className="prob-track">
                  <div className="prob-fill" style={{
                    width: `${prob * 100}%`,
                    background: PERF_COLORS[cls] || '#f5c842'
                  }} />
                </div>
                <span className="prob-pct mono-font">{(prob * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          <div className="divider" />

          <p className="section-label">Burnout Risk</p>
          <div className="perf-big perf-big--sm">
            <div className="perf-label perf-label--sm" style={{ color: burnColor }}>{ml?.burnout_prediction || 'Low'}</div>
          </div>
          <div className="prob-bars">
            {Object.entries(burnoutProbabilities).map(([cls, prob]) => (
              <div key={cls} className="prob-row">
                <span className="prob-label">{cls}</span>
                <div className="prob-track">
                  <div className="prob-fill" style={{
                    width: `${prob * 100}%`,
                    background: BURN_COLORS[cls] || '#f5c842'
                  }} />
                </div>
                <span className="prob-pct mono-font">{(prob * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module tabs */}
      <div className="module-tabs-section">
        <div className="tabs-header">
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabButton key={key} active={activeTab === key} onClick={() => setActiveTab(key)}>
              <Icon size={14} /> {label}
            </TabButton>
          ))}
        </div>

        <div className="tab-content animate-fade-in" key={activeTab}>
          {/* ML Predictions Tab */}
          {activeTab === 'ml' && (
            <div className="tab-panel">
              <div className="charts-2col">
                <div className="card">
                  <p className="section-label">Performance Probabilities (BoW)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={perfData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#9098b0', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9098b0', fontSize: 11 }} domain={[0, 1]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {perfData.map(entry => (
                          <Cell key={entry.name} fill={PERF_COLORS[entry.name] || '#f5c842'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <p className="section-label">Burnout Risk Distribution</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={burnData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#9098b0', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9098b0', fontSize: 11 }} domain={[0, 1]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {burnData.map(entry => (
                          <Cell key={entry.name} fill={BURN_COLORS[entry.name] || '#f5c842'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <p className="section-label">Model Architecture Summary</p>
                <div className="arch-display">
                  {['Input (16 features)', 'FC(128) + BN + ReLU + Dropout(0.3)', 'FC(64) + BN + ReLU + Dropout(0.2)', 'FC(32) + ReLU', 'Head 1: Performance (4-class)', 'Head 2: Burnout (3-class)'].map((layer, i) => (
                    <div key={layer} className="arch-layer">
                      <div className="arch-node">{i + 1}</div>
                      <div className="arch-label mono-font">{layer}</div>
                      {i < 5 && <div className="arch-arrow">↓</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NLP Tab */}
          {activeTab === 'nlp' && (
            <div className="tab-panel">
              <div className="charts-2col">
                <div className="card">
                  <p className="section-label">TF-IDF vs BoW Comparison</p>
                  {tfidfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={tfidfData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" tick={{ fill: '#9098b0', fontSize: 10 }} />
                        <YAxis dataKey="word" type="category" tick={{ fill: '#9098b0', fontSize: 10 }} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="bow" fill="#4dd9e0" name="BoW" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="tfidf" fill="#f5c842" name="TF-IDF" radius={[0, 4, 4, 0]} />
                        <Legend wrapperStyle={{ color: '#9098b0', fontSize: 11 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-muted">No words found in resume text.</p>}
                </div>

                <div className="card">
                  <p className="section-label">Extracted Skills ({extractedSkills.length})</p>
                  <div className="skills-cloud">
                    {extractedSkills.length > 0
                      ? extractedSkills.map(sk => (
                          <span key={sk} className="skill-chip">{sk}</span>
                        ))
                      : <p className="text-muted">No known skills detected in resume text.</p>
                    }
                  </div>

                  <div className="divider" />

                  <p className="section-label">Skill Gaps for {input?.goal || studentInput?.goal || 'Career Goal'}</p>
                  <div className="skills-cloud">
                    {skillGaps.length > 0
                      ? skillGaps.map(sk => (
                          <span key={sk} className="skill-chip skill-chip--missing">{sk}</span>
                        ))
                      : <div className="all-good"><CheckCircle size={14} className="text-green" /> All required skills present!</div>
                    }
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="section-label">NLP Processing Pipeline</p>
                <div className="nlp-pipeline">
                  <div className="pipeline-step">
                    <div className="pipeline-num">1</div>
                    <div>
                      <div className="pipeline-name">Tokenization</div>
                      <div className="pipeline-val mono-font text-secondary">{nlp?.tokens_sample?.join(', ') || 'n/a'}...</div>
                    </div>
                  </div>
                  <div className="pipeline-arrow">→</div>
                  <div className="pipeline-step">
                    <div className="pipeline-num">2</div>
                    <div>
                      <div className="pipeline-name">Bigrams</div>
                      <div className="pipeline-val mono-font text-secondary">{nlp?.bigrams?.join(' | ') || 'n/a'}</div>
                    </div>
                  </div>
                  <div className="pipeline-arrow">→</div>
                  <div className="pipeline-step">
                    <div className="pipeline-num">3</div>
                    <div>
                      <div className="pipeline-name">Trigrams</div>
                      <div className="pipeline-val mono-font text-secondary">{nlp?.trigrams?.join(' | ') || 'n/a'}</div>
                    </div>
                  </div>
                  <div className="pipeline-arrow">→</div>
                  <div className="pipeline-step">
                    <div className="pipeline-num">4</div>
                    <div>
                      <div className="pipeline-name">TF-IDF Vectors</div>
                      <div className="pipeline-val mono-font text-secondary">{nlp?.token_count ?? 0} tokens vectorized</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expert System Tab */}
          {activeTab === 'expert' && (
            <div className="tab-panel">
              <div className="expert-summary">
                <div className="badge badge-gold"><Zap size={10} /> {expert?.rules_fired ?? 0} rules fired</div>
                <p className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
                  Forward chaining inference evaluated all 10 production rules against the student's working memory.
                </p>
              </div>

              {(expert?.rules_fired ?? 0) === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <CheckCircle size={32} className="text-green" style={{ margin: '0 auto 12px' }} />
                  <h3>No issues detected</h3>
                  <p className="text-secondary">All student metrics are within safe thresholds.</p>
                </div>
              ) : (
                <div className="rules-list">
                  {expertRules.map((rule, i) => (
                    <div key={rule.id} className={`rule-card card animate-fade-up delay-${(i % 3) + 1}`}>
                      <div className="rule-header">
                        <span className="rule-id badge badge-gold">{rule.id}</span>
                        <span className="rule-name">{rule.name}</span>
                        <span className="rule-conclusion badge badge-red">{rule.conclusion}</span>
                      </div>
                      <div className="rule-conditions">
                        {rule.conditions.map((cond, j) => (
                          <div key={j} className="condition-row">
                            <CheckCircle size={12} className="text-green" />
                            <code className="mono-font">{cond.key} {cond.op} {cond.threshold}</code>
                            <span className="text-muted">→ actual:</span>
                            <code className="mono-font text-gold">{cond.actual}</code>
                          </div>
                        ))}
                      </div>
                      <div className="rule-advice">
                        <Info size={13} className="text-cyan" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p>{rule.advice}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Roadmap Tab */}
          {activeTab === 'roadmap' && (
            <div className="tab-panel">
              <div className="card">
                <div className="roadmap-header">
                  <p className="section-label">A* Optimal Path → {input?.goal || studentInput?.goal || 'Career Goal'}</p>
                  <div className="roadmap-meta">
                    <span className="badge badge-gold">Cost: {roadmap?.total_cost ?? 0}</span>
                    <span className="badge badge-cyan">{roadmap?.steps ?? roadmapPath.length} nodes</span>
                  </div>
                </div>
                <div className="roadmap-visual">
                  {roadmapPath.map((node, i) => (
                    <React.Fragment key={node}>
                      <div className={`roadmap-node ${i === 0 ? 'roadmap-node--start' : i === roadmapPath.length - 1 ? 'roadmap-node--goal' : ''}`}>
                        <div className="roadmap-num">{i + 1}</div>
                        <div className="roadmap-label">{node.replace(' Goal', '')}</div>
                      </div>
                      {i < roadmapPath.length - 1 && (
                        <div className="roadmap-arrow">→</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="card">
                <p className="section-label">A* Node Expansion Trace (g, h, f values)</p>
                <table className="trace-table">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>g(n) — cost from start</th>
                      <th>h(n) — heuristic</th>
                      <th>f(n) = g + h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roadmap?.astar_trace?.map((row, i) => (
                      <tr key={i}>
                        <td className="mono-font">{row.node}</td>
                        <td className="mono-font text-cyan">{row.g.toFixed(3)}</td>
                        <td className="mono-font text-gold">{row.h.toFixed(3)}</td>
                        <td className="mono-font text-green">{row.f.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="charts-2col">
                <div className="card">
                  <p className="section-label">BFS Path</p>
                  <div className="path-chips">
                    {roadmap?.bfs_path?.map((n, i) => (
                      <React.Fragment key={n + i}>
                        <span className="path-chip path-chip--cyan">{n.replace(' Goal', '')}</span>
                        {i < roadmap.bfs_path.length - 1 && <span className="text-muted">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <p className="section-label">DFS Path</p>
                  <div className="path-chips">
                    {roadmap?.dfs_path?.map((n, i) => (
                      <React.Fragment key={n + i}>
                        <span className="path-chip path-chip--purple">{n.replace(' Goal', '')}</span>
                        {i < roadmap.dfs_path.length - 1 && <span className="text-muted">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FOL Tab */}
          {activeTab === 'fol' && (
            <div className="tab-panel">
              {folConclusions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <CheckCircle size={32} className="text-green" style={{ margin: '0 auto 12px' }} />
                  <h3>No FOL violations detected</h3>
                  <p className="text-secondary">All logical rules evaluated as safe.</p>
                </div>
              ) : (
                <div className="rules-list">
                  {folConclusions.map((c, i) => (
                    <div key={i} className={`rule-card card animate-fade-up delay-${(i % 3) + 1}`}>
                      <div className="rule-header">
                        <span className="rule-id badge badge-purple">FOL</span>
                        <code className="mono-font rule-name">{c.rule}</code>
                      </div>
                      <div className="rule-binding">
                        <span className="badge badge-gold">{c.conclusion}</span>
                      </div>
                      <div className="rule-advice">
                        <Info size={13} className="text-cyan" style={{ flexShrink: 0 }} />
                        <p>{c.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <p className="section-label">Knowledge Graph — Career Skill Analysis</p>
                <div className="career-skills-grid">
                  {careerRequiredSkills.map(sk => {
                    const has = studentSkills.includes(sk)
                    return (
                      <div key={sk} className={`career-skill ${has ? 'career-skill--have' : 'career-skill--missing'}`}>
                        {has ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        {sk}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Agent Monitor Tab */}
          {activeTab === 'agent' && (
            <div className="tab-panel">
              <div className="card">
                <p className="section-label">8-Week Grade Trajectory</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={agentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="week" tick={{ fill: '#9098b0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9098b0', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="grade" stroke="#f5c842" strokeWidth={2} dot={{ fill: '#f5c842', r: 4 }} name="Grade %" />
                    <Line type="monotone" dataKey="attendance" stroke="#4dd9e0" strokeWidth={2} dot={{ fill: '#4dd9e0', r: 4 }} strokeDasharray="4 2" name="Attendance %" />
                    <Legend wrapperStyle={{ color: '#9098b0', fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="agent-weeks">
                {agentWeeks.map(w => (
                  <div key={w.week} className={`week-card card ${(Array.isArray(w?.alerts) ? w.alerts.length : 0) > 0 ? 'week-card--alert' : ''}`}>
                    <div className="week-header">
                      <span className="week-num mono-font">Week {w.week}</span>
                      {(Array.isArray(w?.alerts) ? w.alerts.length : 0) > 0 && <AlertTriangle size={14} className="text-gold" />}
                    </div>
                    <div className="week-grade" style={{ color: (w?.grade ?? w?.observation?.actual_grade ?? 0) >= 0.6 ? '#52d68a' : (w?.grade ?? w?.observation?.actual_grade ?? 0) >= 0.4 ? '#f5c842' : '#e85454' }}>
                      {(((w?.grade ?? w?.observation?.actual_grade ?? 0) * 100)).toFixed(1)}%
                    </div>
                    {(Array.isArray(w?.alerts) ? w.alerts : []).map(a => (
                      <div key={a} className="week-alert">{a.replace(/_/g, ' ')}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
