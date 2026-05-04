"""
CareBridge AI Service
=====================
FastAPI microservice exposing /predict-image for wound risk classification.

Mock inference mode (default):
  Derives risk deterministically from the image content hash so the same
  photo always returns the same result during demos.

Real model mode (optional):
  Copy wound_classifier.pt (produced by ml-training/train.py) into this
  directory.  The service auto-loads it at startup and uses it for inference.

Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

import hashlib
import os
import struct
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CareBridge AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Class labels ─────────────────────────────────────────────────────────────

RISK_LABELS = ["GREEN", "YELLOW", "RED"]
EXPLANATIONS = {
    "GREEN": "Wound image appears normal. No visible signs of infection detected.",
    "YELLOW": "Wound image shows mild redness or irregular coloring. Monitor closely.",
    "RED": (
        "Wound image indicates possible infection "
        "(abnormal tissue coloring, discharge markers, or severe redness)."
    ),
}

# ─── Optional: load trained PyTorch model ─────────────────────────────────────

_model = None          # torch.nn.Module or None
_img_size = 32         # must match ml-training/train.py IMG_SIZE

MODEL_PATH = os.path.join(os.path.dirname(__file__), "wound_classifier.pt")


def _try_load_model():
    """Attempt to load wound_classifier.pt; silently skip if unavailable."""
    global _model
    if not os.path.exists(MODEL_PATH):
        return
    try:
        import torch
        import torch.nn as nn

        class _WoundCNN(nn.Module):
            """Mirror of the architecture in ml-training/train.py."""
            def __init__(self):
                super().__init__()
                self.features = nn.Sequential(
                    nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                    nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                )
                size = _img_size // 8  # after 3 × MaxPool2d(2)
                self.classifier = nn.Sequential(
                    nn.Flatten(),
                    nn.Linear(64 * size * size, 128), nn.ReLU(), nn.Dropout(0.3),
                    nn.Linear(128, 3),
                )

            def forward(self, x):
                return self.classifier(self.features(x))

        net = _WoundCNN()
        net.load_state_dict(
            torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        )
        net.eval()
        _model = net
        print(f"[AI Service] Loaded trained model from {MODEL_PATH}")
    except (ImportError, RuntimeError, Exception) as exc:  # noqa: BLE001
        print(f"[AI Service] Could not load model ({exc}); using mock inference.")


_try_load_model()


# ─── Inference helpers ────────────────────────────────────────────────────────

def _predict_with_model(image_bytes: bytes) -> dict:
    """Run inference using the loaded PyTorch model."""
    import io
    import torch
    from PIL import Image
    import numpy as np

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((_img_size, _img_size))
    arr = np.array(img, dtype=np.float32) / 255.0          # H×W×C
    tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)  # 1×C×H×W

    with torch.no_grad():
        logits = _model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    idx = int(probs.argmax())
    risk = RISK_LABELS[idx]
    confidence = round(float(probs[idx]), 2)
    return {"risk": risk, "confidence": confidence, "explanation": EXPLANATIONS[risk]}


def _predict_mock(image_bytes: bytes) -> dict:
    """
    Deterministic mock inference — derives risk from the image MD5 hash.
    Produces realistic-looking results for demos without a trained model.
    """
    digest = hashlib.md5(image_bytes).digest()
    # Use first 4 bytes to produce a stable 0-99 bucket
    (val,) = struct.unpack("I", digest[:4])
    val = val % 100

    if val < 40:
        risk = "GREEN"
        confidence = round(0.65 + (40 - val) / 200, 2)
    elif val < 70:
        risk = "YELLOW"
        confidence = round(0.55 + (val - 40) / 200, 2)
    else:
        risk = "RED"
        confidence = round(0.60 + (val - 70) / 200, 2)

    return {
        "risk": risk,
        "confidence": min(confidence, 0.95),
        "explanation": EXPLANATIONS[risk],
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "CareBridge AI Service",
        "model_loaded": _model is not None,
    }


@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """
    Accept a wound image and return a risk classification.

    Input : multipart/form-data, field name = 'file'
    Output: { "risk": "GREEN|YELLOW|RED", "confidence": float, "explanation": str }
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (jpg/png/…)")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if _model is not None:
        return _predict_with_model(image_bytes)
    return _predict_mock(image_bytes)
