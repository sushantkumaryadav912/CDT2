from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from torch.utils.data import DataLoader, TensorDataset

from backend.core.models import generate_synthetic_dataset
from backend.services.ml import FEATURE_COLS, StudentMLP, build_features


ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "cdt_model.pt"


def _training_frame(n: int = 500) -> pd.DataFrame:
    students = generate_synthetic_dataset(n)
    rows = []
    for student in students:
        rows.append({
            **build_features(student),
            "performance_label": student.performance_label,
            "burnout_risk": student.burnout_risk,
        })
    return pd.DataFrame(rows)


def train_model(epochs: int = 100) -> dict:
    df = _training_frame()
    scaler = StandardScaler()
    X = scaler.fit_transform(df[FEATURE_COLS].values.astype(np.float32))

    perf_encoder = LabelEncoder()
    burnout_encoder = LabelEncoder()
    y_perf = perf_encoder.fit_transform(df["performance_label"])
    y_burnout = burnout_encoder.fit_transform(df["burnout_risk"])

    X_train, X_test, yp_train, yp_test, yb_train, yb_test = train_test_split(
        X, y_perf, y_burnout, test_size=0.2, random_state=42, stratify=y_perf
    )

    model = StudentMLP(
        input_dim=X_train.shape[1],
        n_perf_classes=len(perf_encoder.classes_),
        n_burnout_classes=len(burnout_encoder.classes_),
    )
    optimizer = optim.Adam(model.parameters(), lr=0.002, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=30, gamma=0.5)
    criterion = nn.CrossEntropyLoss()

    train_ds = TensorDataset(
        torch.FloatTensor(X_train),
        torch.LongTensor(yp_train),
        torch.LongTensor(yb_train),
    )
    loader = DataLoader(train_ds, batch_size=32, shuffle=True)

    for _ in range(epochs):
        model.train()
        for xb, yp_b, yb_b in loader:
            optimizer.zero_grad()
            performance_out, burnout_out = model(xb)
            loss = criterion(performance_out, yp_b) + criterion(burnout_out, yb_b)
            loss.backward()
            optimizer.step()
        scheduler.step()

    model.eval()
    with torch.no_grad():
        performance_out, burnout_out = model(torch.FloatTensor(X_test))
        performance_acc = float((performance_out.argmax(dim=1).numpy() == yp_test).mean())
        burnout_acc = float((burnout_out.argmax(dim=1).numpy() == yb_test).mean())

    return {
        "model_state_dict": model.state_dict(),
        "feature_cols": FEATURE_COLS,
        "scaler_mean": scaler.mean_.astype(float).tolist(),
        "scaler_scale": scaler.scale_.astype(float).tolist(),
        "performance_classes": perf_encoder.classes_.tolist(),
        "burnout_classes": burnout_encoder.classes_.tolist(),
        "metrics": {
            "performance_accuracy": round(performance_acc, 4),
            "burnout_accuracy": round(burnout_acc, 4),
            "test_samples": int(len(X_test)),
        },
    }


def main() -> None:
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    artifact = train_model()
    torch.save(artifact, ARTIFACT_PATH)
    print(f"Saved CDT model artifact to {ARTIFACT_PATH}")
    print(f"Metrics: {artifact['metrics']}")


if __name__ == "__main__":
    main()
