"""
FastAPI backend for Cognitive Digital Twin
Wraps the CDT Python pipeline and exposes REST endpoints.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import sys, os

app = FastAPI(title="CDT API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentInput(BaseModel):
    name: str = "Student"
    cgpa: float = Field(ge=0, le=10)
    attendance: float = Field(ge=0, le=100)
    study_hours_per_week: float = Field(ge=0, le=80)
    assignment_score: float = Field(ge=0, le=100)
    exam_score: float = Field(ge=0, le=100)
    sleep_hours: float = Field(ge=3, le=12)
    extracurricular: int = Field(ge=0, le=2)
    mental_health_score: float = Field(ge=1, le=10)
    library_visits: int = Field(ge=0, le=30)
    online_course_hours: float = Field(ge=0, le=30)
    peer_study_sessions: int = Field(ge=0, le=14)
    semester: int = Field(ge=1, le=8)
    goal: str = "Data Scientist"
    resume_text: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "message": "CDT API running"}


@app.post("/api/analyze")
def analyze(student: StudentInput):
    """
    Run full CDT analysis pipeline on a student profile.
    Tries to import the CDT module; falls back to mock computation.
    """
    try:
        # Try to import the actual CDT module
        parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys.path.insert(0, parent)
        from CDT import cdt, students, nlp, fe, trainer, fol_reasoner, search_engine, expert, career_frames_dict
        from CDT import StudentProfile, compute_labels

        s = StudentProfile(
            student_id="API_STU001",
            name=student.name,
            cgpa=student.cgpa,
            attendance=student.attendance,
            study_hours_per_week=student.study_hours_per_week,
            assignment_score=student.assignment_score,
            exam_score=student.exam_score,
            sleep_hours=student.sleep_hours,
            extracurricular=student.extracurricular,
            mental_health_score=student.mental_health_score,
            library_visits=student.library_visits,
            online_course_hours=student.online_course_hours,
            peer_study_sessions=student.peer_study_sessions,
            resume_text=student.resume_text,
            goal=student.goal,
            semester=student.semester,
        )
        s = compute_labels(s)
        report = cdt.analyze(s)
        return _format_report(report, student.dict())

    except Exception as e:
        # Fall back to fast mock computation
        return _mock_analyze(student.dict())


def _format_report(report, input_data):
    """Convert CDT report dict to API response format."""
    return {
        "student": report.get("student"),
        "student_id": report.get("student_id"),
        "input": input_data,
        "nlp": report.get("nlp", {}),
        "ml": report.get("ml", {}),
        "fol": {
            "conclusions": report.get("fol", {}).get("trace", []),
            "rules_fired": report.get("fol", {}).get("rules_fired", 0),
        },
        "roadmap": report.get("roadmap", {}),
        "expert": report.get("expert", {}),
        "knowledge_graph": report.get("knowledge_graph", {}),
        "agent": {"weeks": _simulate_agent(input_data)},
    }


def _simulate_agent(s):
    import random, math
    random.seed(42)
    base = s.get("exam_score", 60) / 100
    weeks = []
    for i in range(8):
        noise = random.uniform(-0.05, 0.05)
        trend = -0.02 * i if i < 3 else 0.015 * (i - 3)
        grade = min(1, max(0.2, base + trend + noise))
        weeks.append({
            "week": i + 1,
            "grade": round(grade, 3),
            "attendance": min(100, max(40, s.get("attendance", 75) + random.uniform(-5, 5) + (i < 3 and -i or i) * 1.5)),
            "alerts": (["GRADE_DEVIATION", "ATTENDANCE_DECLINE"] if i == 3
                       else ["STUDY_HOURS_DECLINE"] if i == 2 else []),
        })
    return weeks


def _mock_analyze(s):
    """Fast Python mock — mirrors the JS mockApi.js logic."""
    perf_score = (s["cgpa"]/10)*0.4 + (s["exam_score"]/100)*0.35 + (s["attendance"]/100)*0.25
    if perf_score >= 0.80:
        perf_label = "Excellent"
        perf_probs = {"At-Risk": 0.03, "Average": 0.07, "Good": 0.15, "Excellent": 0.75}
    elif perf_score >= 0.65:
        perf_label = "Good"
        perf_probs = {"At-Risk": 0.05, "Average": 0.15, "Good": 0.65, "Excellent": 0.15}
    elif perf_score >= 0.50:
        perf_label = "Average"
        perf_probs = {"At-Risk": 0.15, "Average": 0.60, "Good": 0.18, "Excellent": 0.07}
    else:
        perf_label = "At-Risk"
        perf_probs = {"At-Risk": 0.70, "Average": 0.20, "Good": 0.07, "Excellent": 0.03}

    burnout_score = 0
    if s["study_hours_per_week"] > 50: burnout_score += 2
    elif s["study_hours_per_week"] > 35: burnout_score += 1
    if s["sleep_hours"] < 5: burnout_score += 2
    elif s["sleep_hours"] < 6: burnout_score += 1
    if s["mental_health_score"] < 4: burnout_score += 2
    elif s["mental_health_score"] < 6: burnout_score += 1
    if burnout_score >= 4:
        burn_label = "High"; burn_probs = {"Low": 0.05, "Medium": 0.20, "High": 0.75}
    elif burnout_score >= 2:
        burn_label = "Medium"; burn_probs = {"Low": 0.20, "Medium": 0.60, "High": 0.20}
    else:
        burn_label = "Low"; burn_probs = {"Low": 0.75, "Medium": 0.20, "High": 0.05}

    skills_pool = ["Python","Machine Learning","Data Analysis","SQL","Java","Deep Learning",
                   "NLP","Statistics","R","TensorFlow","PyTorch","Tableau","Research","C++","Docker"]
    text_lower = s.get("resume_text", "").lower()
    skills = [sk for sk in skills_pool if sk.lower() in text_lower]

    career_skills = {
        "Data Scientist": ["Python","SQL","Statistics"],
        "ML Engineer": ["Python","PyTorch","Deep Learning"],
        "AI Researcher": ["Python","Research","NLP"],
        "Software Engineer": ["Python","C++","Data Analysis"],
        "Data Analyst": ["SQL","Statistics","Tableau"],
    }.get(s.get("goal","Data Scientist"), [])

    paths = {
        "Data Scientist": ["Start","Mathematics","Statistics","Machine Learning","Data Scientist Goal"],
        "ML Engineer": ["Start","Mathematics","Programming","Data Structures","Algorithms","Machine Learning","Deep Learning","ML Engineer Goal"],
        "AI Researcher": ["Start","Mathematics","Statistics","Machine Learning","NLP","AI Researcher Goal"],
        "Software Engineer": ["Start","Programming","Data Structures","Algorithms","Software Engineer Goal"],
        "Data Analyst": ["Start","Programming","Databases","Data Analyst Goal"],
    }
    path = paths.get(s.get("goal","Data Scientist"), paths["Data Scientist"])

    expert_rules = []
    if s["cgpa"] < 5.0:
        expert_rules.append({"id":"R01","name":"Critical CGPA Alert","conclusion":"CRITICAL_ACADEMIC_RISK",
            "conditions":[{"key":"cgpa","op":"<","threshold":5.0,"actual":s["cgpa"],"passed":True}],
            "advice":"CGPA is critically low. Immediate academic intervention required."})
    if s["cgpa"] < 6.5 and s["cgpa"] >= 5.0:
        expert_rules.append({"id":"R02","name":"Below-Average CGPA","conclusion":"ACADEMIC_RISK_MODERATE",
            "conditions":[{"key":"cgpa","op":"<","threshold":6.5,"actual":s["cgpa"],"passed":True}],
            "advice":"CGPA is below average. Focus on core subjects and increase study hours."})
    if s["attendance"] < 75:
        expert_rules.append({"id":"R03","name":"Low Attendance Warning","conclusion":"ATTENDANCE_RISK",
            "conditions":[{"key":"attendance","op":"<","threshold":75,"actual":s["attendance"],"passed":True}],
            "advice":f"Attendance {s['attendance']}% is below 75%. Attend all remaining classes."})
    if s["cgpa"] >= 8.0 and s["attendance"] >= 85:
        expert_rules.append({"id":"R06","name":"Strong Academic Track","conclusion":"ON_TRACK_EXCELLENCE",
            "conditions":[{"key":"cgpa","op":">=","threshold":8,"actual":s["cgpa"],"passed":True}],
            "advice":"Excellent! Apply for research internships and scholarships."})
    if s["sleep_hours"] < 5.0:
        expert_rules.append({"id":"R10","name":"Sleep Deprivation","conclusion":"SLEEP_DEPRIVED",
            "conditions":[{"key":"sleep_hours","op":"<","threshold":5,"actual":s["sleep_hours"],"passed":True}],
            "advice":"Chronic sleep deprivation impairs cognition. Prioritize 7-8 hours/night."})

    fol = []
    if s["cgpa"] < 6.0:
        fol.append({"rule":"R1: ∀x [CGPA(x) < 6.0 → AcademicRisk(x)]","conclusion":"ACADEMIC_RISK_HIGH","explanation":f"CGPA={s['cgpa']} below 6.0"})
    if s["attendance"] < 75:
        fol.append({"rule":"R2: ∀x [Attendance(x) < 75 → FailRisk(x)]","conclusion":"FAIL_RISK","explanation":f"Attendance={s['attendance']}% below 75%"})

    pass_prob = min(max((s["exam_score"]/100)*0.5 + (s["attendance"]/100)*0.3 + (s["assignment_score"]/100)*0.2, 0), 1)

    words = [w for w in text_lower.replace("[^a-z ]","").split() if len(w) > 3]
    freq = {}
    for w in words: freq[w] = freq.get(w, 0) + 1
    bow_tfidf = [{"word": w, "bow": c, "tfidf": round(c * 0.25, 4)} for w, c in sorted(freq.items(), key=lambda x: -x[1])[:8]]

    bigrams = [f"{words[i]} {words[i+1]}" for i in range(min(5, len(words)-1))]
    trigrams = [f"{words[i]} {words[i+1]} {words[i+2]}" for i in range(min(3, len(words)-2))]

    astar_trace = [{"node": n, "g": round(i*0.65,3), "h": round((len(path)-i)*0.5,3), "f": round(i*0.65+(len(path)-i)*0.5,3)} for i,n in enumerate(path[:-1])]

    return {
        "student": s.get("name","Student"),
        "student_id": "API_STU001",
        "input": s,
        "nlp": {
            "extracted_skills": skills,
            "token_count": len(words),
            "tokens_sample": words[:12],
            "bigrams": bigrams,
            "trigrams": trigrams,
            "bow_tfidf": bow_tfidf,
            "clean_text": " ".join(words[:30]) + "...",
        },
        "ml": {
            "performance_prediction": perf_label,
            "performance_probabilities": perf_probs,
            "burnout_prediction": burn_label,
            "burnout_probabilities": burn_probs,
            "pass_probability": round(pass_prob, 3),
        },
        "fol": {"conclusions": fol, "rules_fired": len(fol)},
        "roadmap": {
            "path": path,
            "total_cost": round(len(path) * 0.65, 2),
            "steps": len(path),
            "bfs_path": path[:-1] + [s.get("goal","Data Scientist") + " Goal"],
            "dfs_path": ["Start","Mathematics","Linear Algebra","Machine Learning", s.get("goal","Data Scientist") + " Goal"],
            "astar_trace": astar_trace,
        },
        "expert": {
            "rules_fired": len(expert_rules),
            "rules": expert_rules,
            "conclusions": [r["conclusion"] for r in expert_rules],
            "advice": [r["advice"] for r in expert_rules],
        },
        "knowledge_graph": {
            "career_required_skills": career_skills,
            "student_has": skills,
            "skill_gaps": [sk for sk in career_skills if sk not in skills],
        },
        "agent": {"weeks": _simulate_agent(s)},
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)