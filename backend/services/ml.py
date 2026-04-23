from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from backend.core.models import StudentProfile


ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "cdt_model.pt"

PASS_WEIGHTS = {
    "At-Risk": 0.20,
    "Average": 0.62,
    "Good": 0.86,
    "Excellent": 0.97,
}

GRADE_WEIGHTS = {
    "At-Risk": 0.45,
    "Average": 0.62,
    "Good": 0.78,
    "Excellent": 0.90,
}


class ModelArtifactError(RuntimeError):
    pass


class StudentMLP(nn.Module):
    def __init__(self, input_dim: int, n_perf_classes: int = 4, n_burnout_classes: int = 3):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(input_dim, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, 32), nn.ReLU(),
        )
        self.head_performance = nn.Sequential(nn.Linear(32, 16), nn.ReLU(), nn.Linear(16, n_perf_classes))
        self.head_burnout = nn.Sequential(nn.Linear(32, 16), nn.ReLU(), nn.Linear(16, n_burnout_classes))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        shared = self.shared(x)
        return self.head_performance(shared), self.head_burnout(shared)


FEATURE_COLS = [
    "cgpa", "attendance", "study_hours_per_week", "assignment_score", "exam_score",
    "sleep_hours", "mental_health_score", "library_visits", "online_course_hours",
    "peer_study_sessions", "extracurricular", "semester", "academic_momentum",
    "stress_index", "engagement_score", "risk_score",
]


def build_features(student: StudentProfile) -> dict[str, float]:
    stress_index = (10 - student.sleep_hours) * 0.4 + (10 - student.mental_health_score) * 0.6
    return {
        "cgpa": student.cgpa,
        "attendance": student.attendance,
        "study_hours_per_week": student.study_hours_per_week,
        "assignment_score": student.assignment_score,
        "exam_score": student.exam_score,
        "sleep_hours": student.sleep_hours,
        "mental_health_score": student.mental_health_score,
        "library_visits": float(student.library_visits),
        "online_course_hours": student.online_course_hours,
        "peer_study_sessions": float(student.peer_study_sessions),
        "extracurricular": float(student.extracurricular),
        "semester": float(student.semester),
        "academic_momentum": (student.study_hours_per_week * student.cgpa) / 10,
        "stress_index": stress_index,
        "engagement_score": (
            student.library_visits * 2
            + student.online_course_hours * 1.5
            + student.peer_study_sessions * 3
        ),
        "risk_score": ((100 - student.attendance) * 0.3 + (100 - student.exam_score) * 0.4 + stress_index * 3),
    }


def transform_features(student: StudentProfile, artifact: dict[str, Any]) -> np.ndarray:
    feature_values = build_features(student)
    feature_cols = artifact.get("feature_cols", FEATURE_COLS)
    raw = np.array([[feature_values[col] for col in feature_cols]], dtype=np.float32)
    mean = np.array(artifact["scaler_mean"], dtype=np.float32)
    scale = np.array(artifact["scaler_scale"], dtype=np.float32)
    return (raw - mean) / scale


def _derive_scores(performance_classes: list[str], performance_probs: np.ndarray) -> tuple[float, float]:
    pass_probability = float(
        sum(prob * PASS_WEIGHTS.get(label, 0.5) for label, prob in zip(performance_classes, performance_probs))
    )
    predicted_grade = float(
        sum(prob * GRADE_WEIGHTS.get(label, 0.65) for label, prob in zip(performance_classes, performance_probs))
    )
    return round(min(max(pass_probability, 0.0), 1.0), 3), round(min(max(predicted_grade, 0.0), 1.0), 3)


def _format_predictions(
    performance_probs_batch: np.ndarray,
    burnout_probs_batch: np.ndarray,
    performance_classes: list[str],
    burnout_classes: list[str],
) -> list[dict[str, Any]]:
    predictions: list[dict[str, Any]] = []
    for performance_probs, burnout_probs in zip(performance_probs_batch, burnout_probs_batch):
        performance_prediction = performance_classes[int(np.argmax(performance_probs))]
        burnout_prediction = burnout_classes[int(np.argmax(burnout_probs))]
        pass_probability, predicted_grade = _derive_scores(performance_classes, performance_probs)

        predictions.append({
            "performance_prediction": performance_prediction,
            "performance_probabilities": {
                label: round(float(prob), 3) for label, prob in zip(performance_classes, performance_probs)
            },
            "burnout_prediction": burnout_prediction,
            "burnout_probabilities": {
                label: round(float(prob), 3) for label, prob in zip(burnout_classes, burnout_probs)
            },
            "pass_probability": pass_probability,
            "predicted_grade": predicted_grade,
        })
    return predictions


@lru_cache(maxsize=1)
def load_model() -> dict[str, Any]:
    if not ARTIFACT_PATH.exists():
        raise ModelArtifactError(
            f"CDT model artifact is missing at {ARTIFACT_PATH}. Run `python -m backend.train` before starting the API."
        )
    artifact = torch.load(ARTIFACT_PATH, map_location="cpu", weights_only=False)
    model = StudentMLP(
        input_dim=len(artifact["feature_cols"]),
        n_perf_classes=len(artifact["performance_classes"]),
        n_burnout_classes=len(artifact["burnout_classes"]),
    )
    model.load_state_dict(artifact["model_state_dict"])
    model.eval()
    artifact["model"] = model
    return artifact


def predict(student: StudentProfile) -> dict[str, Any]:
    return batch_predict([student])[0]


def batch_predict(students: list[StudentProfile]) -> list[dict[str, Any]]:
    if not students:
        return []

    artifact = load_model()
    x = np.vstack([transform_features(student, artifact) for student in students]).astype(np.float32)
    x_tensor = torch.FloatTensor(x)
    model: StudentMLP = artifact["model"]
    with torch.no_grad():
        performance_out, burnout_out = model(x_tensor)
        performance_probs_batch = torch.softmax(performance_out, dim=1).numpy()
        burnout_probs_batch = torch.softmax(burnout_out, dim=1).numpy()

    performance_classes = artifact["performance_classes"]
    burnout_classes = artifact["burnout_classes"]
    return _format_predictions(performance_probs_batch, burnout_probs_batch, performance_classes, burnout_classes)
