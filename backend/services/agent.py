from __future__ import annotations

import copy
from typing import Any

from backend.core.models import StudentProfile, compute_labels
from backend.services.expert import ExpertSystem
from backend.services.ml import batch_predict


ALERT_THRESHOLDS = {
    "grade_deviation": 0.15,
    "attendance_drop": 5.0,
    "study_drop": 5.0,
}


def _detect_deviations(history: list[dict[str, Any]], observation: dict[str, Any]) -> list[dict[str, Any]]:
    if not history:
        return []
    previous = history[-1]
    deviations = []
    if abs(observation["deviation"]) > ALERT_THRESHOLDS["grade_deviation"]:
        deviations.append({
            "type": "GRADE_DEVIATION",
            "severity": "HIGH" if abs(observation["deviation"]) > 0.25 else "MEDIUM",
            "detail": (
                f"Grade deviation = {observation['deviation']:+.2f} "
                f"(predicted {observation['predicted_grade']:.2f}, actual {observation['actual_grade']:.2f})"
            ),
        })
    attendance_drop = previous.get("attendance", 0) - observation.get("attendance", 0)
    if attendance_drop > ALERT_THRESHOLDS["attendance_drop"]:
        deviations.append({
            "type": "ATTENDANCE_DECLINE",
            "severity": "HIGH" if attendance_drop > 10 else "MEDIUM",
            "detail": f"Attendance dropped by {attendance_drop:.1f}% this week",
        })
    study_drop = previous.get("study_hours_per_week", 0) - observation.get("study_hours_per_week", 0)
    if study_drop > ALERT_THRESHOLDS["study_drop"]:
        deviations.append({
            "type": "STUDY_HOURS_DECLINE",
            "severity": "MEDIUM",
            "detail": f"Study hours dropped by {study_drop:.1f}h/week",
        })
    return deviations


def _interventions(deviations: list[dict[str, Any]], expert_result: dict[str, Any]) -> list[dict[str, str]]:
    actions = []
    for deviation in deviations:
        if deviation["type"] == "GRADE_DEVIATION":
            actions.append({
                "trigger": deviation["type"],
                "action": "SCHEDULE_TUTORIAL",
                "message": f"Alert: {deviation['detail']}. Scheduling tutorial session.",
            })
        elif deviation["type"] == "ATTENDANCE_DECLINE":
            actions.append({
                "trigger": deviation["type"],
                "action": "SEND_ATTENDANCE_REMINDER",
                "message": f"Alert: {deviation['detail']}. Sending reminder to attend classes.",
            })
        elif deviation["type"] == "STUDY_HOURS_DECLINE":
            actions.append({
                "trigger": deviation["type"],
                "action": "RECOMMEND_SCHEDULE_ADJUSTMENT",
                "message": f"Alert: {deviation['detail']}. Recommending revised study schedule.",
            })
    for advice in expert_result["advice"]:
        actions.append({"trigger": "EXPERT_RULE", "action": "ADVISORY", "message": f"Expert Advice: {advice}"})
    return actions


def simulate_monitoring(student: StudentProfile, expert: ExpertSystem, weeks: int = 8) -> list[dict[str, Any]]:
    history = []
    output = []
    base_grade = student.exam_score / 100
    weekly_states = []
    for index in range(weeks):
        recovery = -0.05 * index if index < 4 else 0.03 * (index - 4)
        weekly_states.append({
            "actual_grade": round(min(1.0, max(0.2, base_grade + recovery)), 3),
            "attendance": min(100, max(40, student.attendance - (index * 4 if index < 4 else 12 - index * 2))),
            "study_hours_per_week": max(1, student.study_hours_per_week - (index * 3 if index < 4 else 6 - index)),
            "sleep_hours": max(3, student.sleep_hours - (index * 0.4 if index < 4 else 1.2 - index * 0.1)),
            "mental_health_score": max(1, student.mental_health_score - (index * 0.5 if index < 4 else 1.5 - index * 0.1)),
        })

    weekly_students: list[StudentProfile] = []
    for state in weekly_states:
        current_student = copy.deepcopy(student)
        for key in ["attendance", "study_hours_per_week", "sleep_hours", "mental_health_score"]:
            setattr(current_student, key, state[key])
        weekly_students.append(compute_labels(current_student))

    ml_results = batch_predict(weekly_students)

    for week, (state, current_student, ml_result) in enumerate(zip(weekly_states, weekly_students, ml_results), start=1):
        predicted_grade = float(ml_result["predicted_grade"])
        pass_probability = float(ml_result["pass_probability"])
        observation = {
            "week": week,
            "actual_grade": state["actual_grade"],
            "grade": state["actual_grade"],
            "predicted_grade": round(predicted_grade, 3),
            "deviation": round(state["actual_grade"] - predicted_grade, 3),
            "ml_performance": ml_result["performance_prediction"],
            "ml_burnout": ml_result["burnout_prediction"],
            "pass_prob": round(pass_probability, 3),
            **{key: round(value, 3) for key, value in state.items() if key != "actual_grade"},
        }
        deviations = _detect_deviations(history, observation)
        expert_result = expert.infer(current_student)
        interventions = _interventions(deviations, expert_result)
        history.append(observation)
        output.append({
            "week": week,
            "observation": observation,
            "deviations": deviations,
            "alerts": [deviation["type"] for deviation in deviations],
            "interventions": interventions,
            "action": {
                "interventions": interventions,
                "expert_conclusions": expert_result["conclusions"],
                "ml_prediction": ml_result["performance_prediction"],
                "burnout_level": ml_result["burnout_prediction"],
            },
            "grade": observation["grade"],
            "attendance": observation["attendance"],
        })
    return output
