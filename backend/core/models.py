from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

import numpy as np


SEED = 42

SKILL_POOL = [
    "Python", "Machine Learning", "Data Analysis", "SQL", "Java",
    "Deep Learning", "NLP", "Computer Vision", "Statistics", "R",
    "TensorFlow", "PyTorch", "Hadoop", "Spark", "Tableau",
    "Project Management", "Communication", "Leadership", "Teamwork",
    "Research", "C++", "Web Development", "Cloud Computing", "Docker",
]

GOAL_POOL = [
    "Data Scientist", "Software Engineer", "AI Researcher",
    "Product Manager", "Data Analyst", "ML Engineer",
]

RESUME_TEMPLATES = [
    "Experienced in {s1} and {s2}. Worked on projects involving {s3} and {s4}. "
    "Interested in {s5}. Strong background in {s6} and problem solving.",
    "Proficient in {s1}, {s2}, and {s3}. Research experience in {s4}. "
    "Completed internship using {s5}. Seeking roles in {s6}.",
    "Skilled developer with expertise in {s1} and {s2}. "
    "Built ML models using {s3}. Familiar with {s4}, {s5}, and {s6}.",
]


@dataclass
class StudentProfile:
    student_id: str
    name: str
    cgpa: float
    attendance: float
    study_hours_per_week: float
    assignment_score: float
    exam_score: float
    sleep_hours: float
    extracurricular: int
    mental_health_score: float
    library_visits: int
    online_course_hours: float
    peer_study_sessions: int
    resume_text: str
    goal: str
    semester: int
    performance_label: str = ""
    pass_probability: float = 0.0
    burnout_risk: str = ""


@dataclass
class SubjectFrame:
    name: str
    credits: int
    difficulty: float
    prerequisites: list[str] = field(default_factory=list)
    skills_imparted: list[str] = field(default_factory=list)
    leads_to_careers: list[str] = field(default_factory=list)


@dataclass
class CourseFrame:
    course_id: str
    subject: str
    semester: int
    grade: float | None = None
    completed: bool = False


@dataclass
class CareerFrame:
    title: str
    required_cgpa: float
    required_skills: list[str]
    required_subjects: list[str]
    avg_salary: int
    growth_rate: float


CAREER_FRAMES = {
    "Data Scientist": CareerFrame(
        "Data Scientist", 7.0, ["Python", "SQL", "Statistics", "Machine Learning"],
        ["Machine Learning", "Statistics", "Databases"], 120000, 0.25,
    ),
    "ML Engineer": CareerFrame(
        "ML Engineer", 7.5, ["Python", "PyTorch", "Deep Learning", "Mathematics"],
        ["Machine Learning", "Deep Learning"], 130000, 0.30,
    ),
    "AI Researcher": CareerFrame(
        "AI Researcher", 8.0, ["Python", "Research", "NLP", "Statistics"],
        ["Machine Learning", "NLP"], 150000, 0.35,
    ),
    "Software Engineer": CareerFrame(
        "Software Engineer", 6.5, ["Python", "Data Structures", "Algorithms"],
        ["Programming", "Data Structures", "Algorithms"], 110000, 0.20,
    ),
    "Data Analyst": CareerFrame(
        "Data Analyst", 6.0, ["SQL", "Statistics", "Python"],
        ["Statistics", "Databases"], 90000, 0.18,
    ),
}

ACADEMIC_GRAPH = {
    "Start": [("Mathematics", 0.5), ("Programming", 0.4)],
    "Mathematics": [("Statistics", 0.6), ("Linear Algebra", 0.7)],
    "Programming": [("Data Structures", 0.6), ("Databases", 0.5)],
    "Statistics": [("Probability", 0.55), ("Machine Learning", 0.9)],
    "Linear Algebra": [("Machine Learning", 0.9)],
    "Data Structures": [("Algorithms", 0.8)],
    "Databases": [("Data Analyst Goal", 0.3)],
    "Probability": [("Machine Learning", 0.9)],
    "Algorithms": [("Machine Learning", 0.9), ("Software Engineer Goal", 0.4)],
    "Machine Learning": [("Deep Learning", 0.85), ("NLP", 0.85), ("Data Scientist Goal", 0.2)],
    "Deep Learning": [("ML Engineer Goal", 0.2)],
    "NLP": [("AI Researcher Goal", 0.2)],
    "Data Scientist Goal": [],
    "ML Engineer Goal": [],
    "AI Researcher Goal": [],
    "Data Analyst Goal": [],
    "Software Engineer Goal": [],
}

GOAL_NODES = {
    "Data Scientist Goal", "ML Engineer Goal", "AI Researcher Goal",
    "Data Analyst Goal", "Software Engineer Goal",
}

HEURISTIC = {
    "Start": 3.5,
    "Mathematics": 3.0,
    "Programming": 3.2,
    "Statistics": 2.5,
    "Linear Algebra": 2.8,
    "Data Structures": 2.6,
    "Databases": 2.0,
    "Probability": 2.2,
    "Algorithms": 2.4,
    "Machine Learning": 1.2,
    "Deep Learning": 0.5,
    "NLP": 0.5,
    "Data Scientist Goal": 0.0,
    "ML Engineer Goal": 0.0,
    "AI Researcher Goal": 0.0,
    "Data Analyst Goal": 0.0,
    "Software Engineer Goal": 0.0,
}

GOAL_NODE_MAP = {
    "Data Scientist": "Data Scientist Goal",
    "ML Engineer": "ML Engineer Goal",
    "AI Researcher": "AI Researcher Goal",
    "Data Analyst": "Data Analyst Goal",
    "Software Engineer": "Software Engineer Goal",
}


def generate_resume(skills: list[str], rng: random.Random | None = None) -> str:
    rng = rng or random
    chosen = rng.sample(skills, min(6, len(skills)))
    chosen.extend([""] * (6 - len(chosen)))
    template = rng.choice(RESUME_TEMPLATES)
    return template.format(
        s1=chosen[0], s2=chosen[1], s3=chosen[2],
        s4=chosen[3], s5=chosen[4], s6=chosen[5],
    )


def compute_labels(student: StudentProfile, jitter: bool = False) -> StudentProfile:
    score = (
        (student.cgpa / 10) * 0.4
        + (student.exam_score / 100) * 0.35
        + (student.attendance / 100) * 0.25
    )
    if score >= 0.80:
        student.performance_label = "Excellent"
    elif score >= 0.65:
        student.performance_label = "Good"
    elif score >= 0.50:
        student.performance_label = "Average"
    else:
        student.performance_label = "At-Risk"

    raw = (
        (student.exam_score / 100) * 0.5
        + (student.attendance / 100) * 0.3
        + (student.assignment_score / 100) * 0.2
    )
    noise = random.uniform(-0.05, 0.05) if jitter else 0.0
    student.pass_probability = round(min(max(raw + noise, 0.0), 1.0), 3)

    burnout_score = 0
    if student.study_hours_per_week > 50:
        burnout_score += 2
    elif student.study_hours_per_week > 35:
        burnout_score += 1
    if student.sleep_hours < 5:
        burnout_score += 2
    elif student.sleep_hours < 6:
        burnout_score += 1
    if student.mental_health_score < 4:
        burnout_score += 2
    elif student.mental_health_score < 6:
        burnout_score += 1
    if student.extracurricular == 2 and student.study_hours_per_week > 40:
        burnout_score += 1
    if burnout_score >= 4:
        student.burnout_risk = "High"
    elif burnout_score >= 2:
        student.burnout_risk = "Medium"
    else:
        student.burnout_risk = "Low"
    return student


def student_from_input(data: dict[str, Any]) -> StudentProfile:
    student = StudentProfile(
        student_id=str(data.get("student_id", "API_STU001")),
        name=str(data.get("name", "Student")),
        cgpa=float(data["cgpa"]),
        attendance=float(data["attendance"]),
        study_hours_per_week=float(data["study_hours_per_week"]),
        assignment_score=float(data["assignment_score"]),
        exam_score=float(data["exam_score"]),
        sleep_hours=float(data["sleep_hours"]),
        extracurricular=int(data["extracurricular"]),
        mental_health_score=float(data["mental_health_score"]),
        library_visits=int(data["library_visits"]),
        online_course_hours=float(data["online_course_hours"]),
        peer_study_sessions=int(data["peer_study_sessions"]),
        resume_text=str(data.get("resume_text", "")),
        goal=str(data.get("goal", "Data Scientist")),
        semester=int(data["semester"]),
    )
    return compute_labels(student)


def generate_synthetic_dataset(n: int = 500, seed: int = SEED) -> list[StudentProfile]:
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    students = []
    for i in range(n):
        skills = rng.sample(SKILL_POOL, rng.randint(4, 10))
        student = StudentProfile(
            student_id=f"STU{i + 1:04d}",
            name=f"Student_{i + 1}",
            cgpa=round(float(np.clip(np_rng.normal(6.5, 1.5), 2.0, 10.0)), 2),
            attendance=round(float(np.clip(np_rng.normal(75, 15), 20, 100)), 1),
            study_hours_per_week=round(float(np.clip(np_rng.normal(25, 10), 2, 70)), 1),
            assignment_score=round(float(np.clip(np_rng.normal(65, 18), 10, 100)), 1),
            exam_score=round(float(np.clip(np_rng.normal(60, 20), 10, 100)), 1),
            sleep_hours=round(float(np.clip(np_rng.normal(6.5, 1.2), 3, 10)), 1),
            extracurricular=rng.choice([0, 0, 1, 1, 1, 2]),
            mental_health_score=round(float(np.clip(np_rng.normal(6, 2), 1, 10)), 1),
            library_visits=max(0, int(np_rng.poisson(4))),
            online_course_hours=round(float(np.clip(np_rng.exponential(3), 0, 20)), 1),
            peer_study_sessions=max(0, int(np_rng.poisson(2))),
            resume_text=generate_resume(skills, rng),
            goal=rng.choice(GOAL_POOL),
            semester=rng.randint(1, 8),
        )
        students.append(compute_labels(student, jitter=True))
    return students
