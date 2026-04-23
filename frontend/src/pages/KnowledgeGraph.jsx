import React, { useState, useRef } from 'react'
import { Network, ChevronRight } from 'lucide-react'
import { useCDT } from '../store/CDTContext'
import './KnowledgeGraph.css'

// Full knowledge base mirroring the Python SemanticNetwork
const NODES = {
  // Subjects
  Mathematics:    { type: 'subject', difficulty: 0.8 },
  Statistics:     { type: 'subject', difficulty: 0.7 },
  Programming:    { type: 'subject', difficulty: 0.6 },
  'Data Structures': { type: 'subject', difficulty: 0.75 },
  Algorithms:     { type: 'subject', difficulty: 0.85 },
  'Machine Learning': { type: 'subject', difficulty: 0.9 },
  'Deep Learning':  { type: 'subject', difficulty: 0.95 },
  NLP:            { type: 'subject', difficulty: 0.88 },
  Databases:      { type: 'subject', difficulty: 0.6 },
  'Linear Algebra': { type: 'subject', difficulty: 0.72 },
  Probability:    { type: 'subject', difficulty: 0.65 },
  // Skills
  Python:         { type: 'skill', market_value: 0.95 },
  SQL:            { type: 'skill', market_value: 0.85 },
  PyTorch:        { type: 'skill', market_value: 0.90 },
  TensorFlow:     { type: 'skill', market_value: 0.88 },
  'Research Methods': { type: 'skill', market_value: 0.70 },
  // Careers
  'Data Scientist':   { type: 'career', avg_salary: 120000 },
  'ML Engineer':      { type: 'career', avg_salary: 130000 },
  'AI Researcher':    { type: 'career', avg_salary: 150000 },
  'Software Engineer':{ type: 'career', avg_salary: 110000 },
  'Data Analyst':     { type: 'career', avg_salary: 90000 },
}

const EDGES = [
  // Prerequisites
  { from: 'Mathematics', to: 'Statistics', type: 'prerequisite_of' },
  { from: 'Mathematics', to: 'Machine Learning', type: 'prerequisite_of' },
  { from: 'Mathematics', to: 'Linear Algebra', type: 'prerequisite_of' },
  { from: 'Statistics', to: 'Machine Learning', type: 'prerequisite_of' },
  { from: 'Statistics', to: 'Probability', type: 'prerequisite_of' },
  { from: 'Programming', to: 'Data Structures', type: 'prerequisite_of' },
  { from: 'Programming', to: 'Databases', type: 'prerequisite_of' },
  { from: 'Programming', to: 'Machine Learning', type: 'prerequisite_of' },
  { from: 'Data Structures', to: 'Algorithms', type: 'prerequisite_of' },
  { from: 'Algorithms', to: 'Machine Learning', type: 'prerequisite_of' },
  { from: 'Machine Learning', to: 'Deep Learning', type: 'prerequisite_of' },
  { from: 'Machine Learning', to: 'NLP', type: 'prerequisite_of' },
  { from: 'Linear Algebra', to: 'Machine Learning', type: 'prerequisite_of' },
  { from: 'Probability', to: 'Machine Learning', type: 'prerequisite_of' },
  // Requires (career → skill)
  { from: 'Data Scientist', to: 'Python', type: 'requires' },
  { from: 'Data Scientist', to: 'SQL', type: 'requires' },
  { from: 'Data Scientist', to: 'Statistics', type: 'requires' },
  { from: 'ML Engineer', to: 'PyTorch', type: 'requires' },
  { from: 'ML Engineer', to: 'Python', type: 'requires' },
  { from: 'AI Researcher', to: 'Research Methods', type: 'requires' },
  { from: 'AI Researcher', to: 'PyTorch', type: 'requires' },
  { from: 'Data Analyst', to: 'SQL', type: 'requires' },
  { from: 'Data Analyst', to: 'Statistics', type: 'requires' },
  { from: 'Software Engineer', to: 'Python', type: 'requires' },
  // Leads to (subject → career)
  { from: 'Machine Learning', to: 'Data Scientist', type: 'leads_to' },
  { from: 'Deep Learning', to: 'ML Engineer', type: 'leads_to' },
  { from: 'NLP', to: 'AI Researcher', type: 'leads_to' },
  { from: 'Databases', to: 'Data Analyst', type: 'leads_to' },
  { from: 'Algorithms', to: 'Software Engineer', type: 'leads_to' },
  { from: 'Machine Learning', to: 'ML Engineer', type: 'leads_to' },
]

// Static layout positions (hand-crafted for clarity)
const POSITIONS = {
  Mathematics:    { x: 200, y: 80 },
  'Linear Algebra':{ x: 100, y: 180 },
  Statistics:     { x: 300, y: 180 },
  Probability:    { x: 410, y: 260 },
  Programming:    { x: 540, y: 80 },
  'Data Structures':{ x: 480, y: 190 },
  Databases:      { x: 630, y: 190 },
  Algorithms:     { x: 510, y: 300 },
  'Machine Learning':{ x: 300, y: 360 },
  'Deep Learning':  { x: 160, y: 460 },
  NLP:            { x: 370, y: 470 },
  Python:         { x: 680, y: 330 },
  SQL:            { x: 760, y: 420 },
  PyTorch:        { x: 80, y: 540 },
  TensorFlow:     { x: 180, y: 560 },
  'Research Methods':{ x: 460, y: 560 },
  'Data Scientist': { x: 310, y: 570 },
  'ML Engineer':    { x: 120, y: 640 },
  'AI Researcher':  { x: 430, y: 650 },
  'Software Engineer':{ x: 600, y: 500 },
  'Data Analyst':   { x: 720, y: 520 },
}

const TYPE_COLORS = {
  subject: '#4dd9e0',
  skill: '#52d68a',
  career: '#f5c842',
}

const EDGE_COLORS = {
  prerequisite_of: 'rgba(77,217,224,0.4)',
  requires: 'rgba(82,214,138,0.4)',
  leads_to: 'rgba(245,200,66,0.5)',
}

const EDGE_DASH = {
  prerequisite_of: '0',
  requires: '4,3',
  leads_to: '2,2',
}

export default function KnowledgeGraph() {
  const { analysisResult } = useCDT()
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [filter, setFilter] = useState('all')
  const svgRef = useRef(null)

  const studentSkills = analysisResult?.nlp?.extracted_skills || []
  const skillGaps = analysisResult?.knowledge_graph?.skill_gaps || []
  const activeGoal = analysisResult?.career || analysisResult?.input?.goal || null

  const activeNode = hovered || selected

  // Get connected edges for highlight
  const connectedEdges = activeNode
    ? EDGES.filter(e => e.from === activeNode || e.to === activeNode)
    : []
  const connectedNodes = new Set(connectedEdges.flatMap(e => [e.from, e.to]))

  const nodeInfo = activeNode ? NODES[activeNode] : null
  const outEdges = activeNode ? EDGES.filter(e => e.from === activeNode) : []
  const inEdges = activeNode ? EDGES.filter(e => e.to === activeNode) : []

  return (
    <div className="kg animate-fade-in">
      <div className="kg__header">
        <div className="page-eyebrow">
          <Network size={16} className="text-gold" />
          <span className="section-label">Knowledge Representation</span>
        </div>
        <h1 className="page-title">Academic Knowledge Graph</h1>
        <p className="page-desc text-secondary">
          Interactive semantic network representing relationships between subjects, skills, and careers.
          Click any node to explore connections and properties.
        </p>
      </div>

      <div className="kg__body">
        {/* Controls */}
        <div className="kg__controls card">
          <div className="filter-btns">
            {['all', 'subject', 'skill', 'career'].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </button>
            ))}
          </div>
          <div className="legend">
            {Object.entries(EDGE_COLORS).map(([type, color]) => (
              <div key={type} className="legend-item">
                <svg width="24" height="8">
                  <line x1="0" y1="4" x2="24" y2="4" stroke={color.replace('0.4', '1').replace('0.5', '1')} strokeWidth="2" strokeDasharray={EDGE_DASH[type]} />
                </svg>
                <span>{type.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="legend-item">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kg__main">
          {/* SVG Graph */}
          <div className="graph-container card">
            <svg ref={svgRef} viewBox="0 0 840 700" className="graph-svg">
              {/* Arrow markers */}
              <defs>
                {Object.entries(EDGE_COLORS).map(([type, color]) => (
                  <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8"
                    refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill={color.replace(/0\.\d+\)/, '0.8)')} />
                  </marker>
                ))}
              </defs>

              {/* Edges */}
              {EDGES.map((edge, i) => {
                const from = POSITIONS[edge.from]
                const to = POSITIONS[edge.to]
                if (!from || !to) return null
                const isHighlighted = connectedEdges.includes(edge)
                const isDimmed = activeNode && !isHighlighted
                const color = EDGE_COLORS[edge.type]

                // Offset to avoid overlap
                const dx = to.x - from.x
                const dy = to.y - from.y
                const len = Math.sqrt(dx * dx + dy * dy)
                const nx = dx / len; const ny = dy / len
                const fromR = 24; const toR = 26
                const x1 = from.x + nx * fromR
                const y1 = from.y + ny * fromR
                const x2 = to.x - nx * toR
                const y2 = to.y - ny * toR

                return (
                  <line key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isHighlighted ? color.replace(/0\.\d+\)/, '1)') : color}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={EDGE_DASH[edge.type]}
                    opacity={isDimmed ? 0.1 : 1}
                    markerEnd={`url(#arrow-${edge.type})`}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                )
              })}

              {/* Nodes */}
              {Object.entries(NODES).map(([name, data]) => {
                const pos = POSITIONS[name]
                if (!pos) return null
                const isVisible = filter === 'all' || data.type === filter
                if (!isVisible) return null
                const isActive = name === activeNode
                const isConnected = connectedNodes.has(name)
                const isDimmed = activeNode && !isActive && !isConnected
                const color = TYPE_COLORS[data.type]
                const isStudentSkill = data.type === 'skill' && studentSkills.includes(name)
                const isMissingSkill = data.type === 'skill' && skillGaps.includes(name)

                return (
                  <g
                    key={name}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.2s' }}
                    onClick={() => setSelected(selected === name ? null : name)}
                    onMouseEnter={() => setHovered(name)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Glow */}
                    {isActive && (
                      <circle r={30} fill={color} opacity={0.15} />
                    )}
                    {/* Circle */}
                    <circle
                      r={isActive ? 22 : 18}
                      fill={isActive ? color : isMissingSkill ? 'rgba(232,84,84,0.18)' : isStudentSkill ? 'rgba(82,214,138,0.18)' : `${color}22`}
                      stroke={isMissingSkill ? '#e85454' : isStudentSkill ? '#52d68a' : color}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      style={{ transition: 'all 0.2s' }}
                    />
                    {/* Icon/letter */}
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={isActive ? 11 : 9}
                      fill={isActive ? '#060608' : color}
                      fontWeight="700"
                      fontFamily="Space Mono, monospace"
                    >
                      {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </text>
                    {/* Label */}
                    <text
                      textAnchor="middle"
                      dy="34"
                      fontSize="8.5"
                      fill={isActive ? color : '#9098b0'}
                      fontFamily="DM Sans, sans-serif"
                      fontWeight={isActive ? '600' : '400'}
                    >
                      {name.length > 14 ? name.slice(0, 13) + '…' : name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Info panel */}
          <div className="kg__panel">
            <div className="card kg-student-summary">
              <p className="section-label">Student Overlay</p>
              {analysisResult ? (
                <>
                  <p className="kg-student-summary__goal">Goal: {activeGoal || 'N/A'}</p>
                  <div className="kg-student-summary__metrics">
                    <span className="badge badge-green">Skills Found: {studentSkills.length}</span>
                    <span className={`badge ${skillGaps.length > 0 ? 'badge-red' : 'badge-green'}`}>
                      Skill Gaps: {skillGaps.length}
                    </span>
                  </div>
                  <p className="kg-student-summary__hint text-secondary">
                    Graph overlay colors: green = detected skills, red = missing required skills.
                  </p>
                </>
              ) : (
                <p className="kg-student-summary__hint text-secondary">
                  Run analysis first to overlay student skills and career gaps on the graph.
                </p>
              )}
            </div>

            {activeNode && nodeInfo ? (
              <div className="info-card card animate-fade-in">
                <div className="info-type">
                  <div className="info-dot" style={{ background: TYPE_COLORS[nodeInfo.type] }} />
                  <span className="section-label" style={{ margin: 0 }}>{nodeInfo.type}</span>
                </div>
                <h2 className="info-name">{activeNode}</h2>

                {nodeInfo.type === 'subject' && (
                  <div className="info-attr">
                    <span className="info-attr__label">Difficulty</span>
                    <div className="progress-bar" style={{ marginTop: 4 }}>
                      <div className="progress-fill bg-gold" style={{ width: `${nodeInfo.difficulty * 100}%` }} />
                    </div>
                    <span className="info-attr__val mono-font">{(nodeInfo.difficulty * 10).toFixed(1)} / 10</span>
                  </div>
                )}

                {nodeInfo.type === 'skill' && (
                  <div className="info-attr">
                    <span className="info-attr__label">Market Value</span>
                    <div className="progress-bar" style={{ marginTop: 4 }}>
                      <div className="progress-fill bg-green" style={{ width: `${nodeInfo.market_value * 100}%` }} />
                    </div>
                    <span className="info-attr__val mono-font">{(nodeInfo.market_value * 100).toFixed(0)}%</span>
                  </div>
                )}

                {nodeInfo.type === 'career' && (
                  <div className="info-attr">
                    <span className="info-attr__label">Avg Salary</span>
                    <span className="info-attr__val text-gold mono-font">${nodeInfo.avg_salary.toLocaleString()}</span>
                  </div>
                )}

                <div className="divider" />

                {outEdges.length > 0 && (
                  <div className="info-edges">
                    <p className="section-label">Outgoing Connections</p>
                    {outEdges.map((e, i) => (
                      <div key={i} className="edge-row">
                        <span className={`edge-type edge-type--${e.type.split('_')[0]}`}>
                          {e.type.replace(/_/g, ' ')}
                        </span>
                        <ChevronRight size={12} className="text-muted" />
                        <button
                          className="edge-target"
                          onClick={() => setSelected(e.to)}
                        >
                          {e.to}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {inEdges.length > 0 && (
                  <div className="info-edges" style={{ marginTop: 12 }}>
                    <p className="section-label">Incoming Connections</p>
                    {inEdges.map((e, i) => (
                      <div key={i} className="edge-row">
                        <button
                          className="edge-target"
                          onClick={() => setSelected(e.from)}
                        >
                          {e.from}
                        </button>
                        <ChevronRight size={12} className="text-muted" />
                        <span className={`edge-type edge-type--${e.type.split('_')[0]}`}>
                          {e.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="info-placeholder card">
                <Network size={32} className="text-muted" />
                <p className="text-secondary" style={{ fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 1.6 }}>
                  Click any node to explore its properties, connections, and relationships in the knowledge graph.
                </p>
                <div className="node-counts">
                  <div className="count-row">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4dd9e0' }} />
                    <span>{Object.values(NODES).filter(n => n.type === 'subject').length} Subjects</span>
                  </div>
                  <div className="count-row">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#52d68a' }} />
                    <span>{Object.values(NODES).filter(n => n.type === 'skill').length} Skills</span>
                  </div>
                  <div className="count-row">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f5c842' }} />
                    <span>{Object.values(NODES).filter(n => n.type === 'career').length} Careers</span>
                  </div>
                  <div className="count-row">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#9098b0' }} />
                    <span>{EDGES.length} Edges</span>
                  </div>
                </div>
              </div>
            )}

            {/* FOL Summary */}
            <div className="card fol-summary">
              <p className="section-label">Frame Representation</p>
              <div className="fol-block mono-font">
                <div className="fol-line"><span className="fol-key">SubjectFrame</span>: Machine Learning</div>
                <div className="fol-line fol-indent">credits: <span className="fol-val">4</span></div>
                <div className="fol-line fol-indent">difficulty: <span className="fol-val">0.90</span></div>
                <div className="fol-line fol-indent">prereqs: <span className="fol-val">[Math, Stats, Prog]</span></div>
                <div className="fol-line fol-indent">leads_to: <span className="fol-val">[Data Scientist]</span></div>
              </div>
              <div className="divider" />
              <p className="section-label">FOL Rules</p>
              <div className="fol-block mono-font">
                <div className="fol-line fol-rule">∀x [CGPA(x) &lt; 6.0 → Risk(x)]</div>
                <div className="fol-line fol-rule">∀x [Goal(x,c) ∧ ¬Skill(x,s) → Rec(x,s)]</div>
                <div className="fol-line fol-rule">∀x [CGPA(x) ≥ c.cgpa ∧ Skills(x) → Eligible(x,c)]</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
