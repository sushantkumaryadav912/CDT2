from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.models import CAREER_FRAMES, CareerFrame, StudentProfile
from services.nlp import extract_skills


@dataclass
class Rule:
    id: str
    name: str
    conditions: list[tuple[str, str, float]]
    conclusion: str
    advice: str
    priority: int = 1


class ExpertSystem:
    def __init__(self):
        self.knowledge_base = self._build_knowledge_base()

    def _build_knowledge_base(self) -> list[Rule]:
        rules = [
            Rule("R01", "Critical CGPA Alert", [("cgpa", "<", 5.0)], "CRITICAL_ACADEMIC_RISK",
                 "CGPA is critically low. Immediate academic intervention required. Meet your advisor, enroll in tutoring, and reduce extracurricular load.", 10),
            Rule("R02", "Below-Average CGPA", [("cgpa", "<", 6.5), ("cgpa", ">=", 5.0)], "ACADEMIC_RISK_MODERATE",
                 "CGPA is below average. Focus on core subjects and increase study hours.", 8),
            Rule("R03", "Low Attendance Warning", [("attendance", "<", 75.0)], "ATTENDANCE_RISK",
                 "Attendance below 75%. You may be barred from exams. Attend all remaining classes. Contact faculty if there are medical reasons.", 9),
            Rule("R04", "Burnout Risk - Overworking", [("study_hours_per_week", ">", 55.0), ("sleep_hours", "<", 5.5)], "BURNOUT_HIGH",
                 "You are studying excessively with too little sleep. Reduce study load to 40-45h/week. Sleep 7-8h. Schedule breaks using Pomodoro technique.", 9),
            Rule("R05", "Mental Health Alert", [("mental_health_score", "<", 4.0)], "MENTAL_HEALTH_RISK",
                 "Mental health score is low. Please reach out to the campus counseling center. Prioritize wellbeing; academic performance depends on mental health.", 10),
            Rule("R06", "Strong Academic Track", [("cgpa", ">=", 8.0), ("attendance", ">=", 85.0)], "ON_TRACK_EXCELLENCE",
                 "Excellent performance! Consider applying for research internships, publishing papers, or competitive scholarships.", 5),
            Rule("R07", "Low Engagement", [("library_visits", "<", 2.0), ("online_course_hours", "<", 1.0), ("peer_study_sessions", "<", 1.0)], "LOW_ENGAGEMENT",
                 "Low academic engagement detected. Join study groups, use online platforms, and visit the library weekly.", 6),
            Rule("R08", "At-Risk Exam Performance", [("exam_score", "<", 40.0), ("assignment_score", "<", 50.0)], "EXAM_INTERVENTION_NEEDED",
                 "Both exam and assignment scores are critically low. Request past papers, form a study group, and attend extra tutorials.", 9),
            Rule("R09", "Career Goal Alignment", [("cgpa", ">=", 7.0), ("study_hours_per_week", ">=", 20.0)], "CAREER_READY_TRACK",
                 "Good CGPA and study commitment. Start building a portfolio, practice interview questions, and apply for internships.", 4),
            Rule("R10", "Sleep Deprivation", [("sleep_hours", "<", 5.0)], "SLEEP_DEPRIVED",
                 "Chronic sleep deprivation impairs memory and cognition. Prioritize 7-8 hours of sleep. Academic performance will improve.", 7),
        ]
        return sorted(rules, key=lambda rule: -rule.priority)

    def _evaluate_condition(self, value: Any, operator: str, threshold: float) -> bool:
        value = float(value)
        operations = {
            "<": value < threshold,
            "<=": value <= threshold,
            ">": value > threshold,
            ">=": value >= threshold,
            "==": value == threshold,
            "!=": value != threshold,
        }
        return operations[operator]

    def _rule_expression(self, rule: Rule) -> str:
        lhs = " and ".join(f"{key} {op} {threshold}" for key, op, threshold in rule.conditions)
        return f"{lhs} -> {rule.conclusion}"

    def infer(self, student: StudentProfile) -> dict[str, Any]:
        working_memory = vars(student).copy()
        fired_rules = []
        fired_rule_details = []
        advice = []
        trace = []
        changed = True

        while changed:
            changed = False
            for rule in self.knowledge_base:
                if rule.conclusion in working_memory:
                    continue
                checked = []
                passed = True
                for fact_key, operator, threshold in rule.conditions:
                    fact_value = working_memory.get(fact_key)
                    if fact_value is None:
                        checked.append({
                            "key": fact_key, "op": operator, "threshold": threshold,
                            "actual": None, "passed": False,
                        })
                        passed = False
                        break
                    result = self._evaluate_condition(fact_value, operator, threshold)
                    checked.append({
                        "key": fact_key, "op": operator, "threshold": threshold,
                        "actual": float(fact_value), "passed": result,
                    })
                    if not result:
                        passed = False
                        break
                if passed:
                    working_memory[rule.conclusion] = True
                    fired_rules.append(rule)
                    advice.append(rule.advice)
                    fired_rule_details.append({
                        "id": rule.id,
                        "name": rule.name,
                        "rule": self._rule_expression(rule),
                        "result": True,
                        "conditions": checked,
                        "conclusion": rule.conclusion,
                        "advice": rule.advice,
                    })
                    trace.append({
                        "rule_id": rule.id,
                        "rule_name": rule.name,
                        "rule": self._rule_expression(rule),
                        "result": True,
                        "conditions_checked": checked,
                        "conclusion": rule.conclusion,
                        "advice": rule.advice,
                    })
                    changed = True

        return {
            "rules_fired": len(fired_rules),
            "rules": fired_rule_details,
            "advice": advice,
            "trace": trace,
            "working_memory": working_memory,
            "conclusions": [rule.conclusion for rule in fired_rules],
        }


class FOLReasoner:
    def __init__(self, career_frames: dict[str, CareerFrame] | None = None):
        self.career_frames = career_frames or CAREER_FRAMES

    def evaluate(self, student: StudentProfile) -> list[dict[str, Any]]:
        conclusions = []
        resume_skills = extract_skills(student.resume_text)

        if student.cgpa < 6.0:
            conclusions.append({
                "rule": "R1: forall x [CGPA(x) < 6.0 -> AcademicRisk(x)]",
                "binding": {"x": student.name, "CGPA": student.cgpa},
                "conclusion": "ACADEMIC_RISK_HIGH",
                "explanation": f"CGPA={student.cgpa} is below threshold 6.0",
            })
        if student.attendance < 75.0:
            conclusions.append({
                "rule": "R2: forall x [Attendance(x) < 75 -> FailRisk(x)]",
                "binding": {"x": student.name, "Attendance": student.attendance},
                "conclusion": "FAIL_RISK",
                "explanation": f"Attendance={student.attendance}% is below safe threshold 75.0%",
            })

        career = self.career_frames.get(student.goal)
        if career:
            missing = [skill for skill in career.required_skills if skill not in resume_skills]
            for skill in missing:
                conclusions.append({
                    "rule": f"R3: Goal(x,{student.goal}) and not HasSkill(x,{skill}) -> Recommend(x,{skill})",
                    "binding": {"x": student.name, "goal": student.goal, "missing_skill": skill},
                    "conclusion": f"RECOMMEND_SKILL: {skill}",
                    "explanation": f'Career "{student.goal}" requires "{skill}" but student does not have it',
                })
            if student.cgpa >= career.required_cgpa and not missing:
                conclusions.append({
                    "rule": f"R4: CGPA(x) >= {career.required_cgpa} and SkillsComplete(x,{student.goal}) -> Eligible(x,{student.goal})",
                    "binding": {"x": student.name, "career": student.goal},
                    "conclusion": f"ELIGIBLE_FOR: {student.goal}",
                    "explanation": "CGPA sufficient and all required skills present",
                })

        if student.study_hours_per_week > 50 and student.sleep_hours < 5:
            conclusions.append({
                "rule": "R5: StudyHours(x)>50 and Sleep(x)<5 -> BurnoutRisk(x)",
                "binding": {"study": student.study_hours_per_week, "sleep": student.sleep_hours},
                "conclusion": "BURNOUT_IMMINENT",
                "explanation": f"Extreme study load ({student.study_hours_per_week}h/wk) with insufficient sleep ({student.sleep_hours}h/night)",
            })
        return conclusions
