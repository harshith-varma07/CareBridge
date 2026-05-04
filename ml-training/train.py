"""
CareBridge ML Training Script
==============================
Trains a minimal 3-class CNN on *synthetic* wound images.

Classes
-------
  0 → GREEN  (healthy skin tone)
  1 → YELLOW (mild redness / moderate inflammation)
  2 → RED    (severe redness / simulated discharge patch)

This demonstrates a complete ML pipeline:
  data generation → preprocessing → DataLoader → training loop → validation → model save

Output
------
  wound_classifier.pt   – best model weights (copy to ai-service/ to enable real inference)
  class_mapping.json    – index→label mapping

Run
---
  pip install -r requirements.txt
  python train.py
"""

import json
import os

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
except ImportError:
    raise SystemExit(
        "PyTorch is required.  Install with:\n"
        "  pip install torch torchvision\n"
        "or run:  pip install -r requirements.txt"
    )

# ─── Config ───────────────────────────────────────────────────────────────────

IMG_SIZE = 32          # spatial resolution of synthetic images
N_PER_CLASS = 300      # synthetic samples per class
EPOCHS = 15
BATCH_SIZE = 32
LR = 1e-3
SEED = 42
SAVE_PATH = os.path.join(os.path.dirname(__file__), "wound_classifier.pt")

# ─── Synthetic data generation ────────────────────────────────────────────────

# Mean (R, G, B) values in [0, 255] for each class
_CLASS_COLORS = [
    (220, 185, 170),   # GREEN  — healthy skin
    (200, 115, 105),   # YELLOW — mild redness
    (155,  75,  75),   # RED    — significant redness
]


def generate_dataset(n_per_class: int = N_PER_CLASS, img_size: int = IMG_SIZE, seed: int = SEED):
    """
    Return (X, y) where X is float32 CHW and y is int64.

    Realism tricks applied to RED class:
      • Bright discharge-like patches (simulates wound exudate or lesions).
      • Slightly darker background to mimic bruising.
    """
    rng = np.random.default_rng(seed)
    images, labels = [], []

    for label_idx, (r_mu, g_mu, b_mu) in enumerate(_CLASS_COLORS):
        for _ in range(n_per_class):
            img = np.empty((img_size, img_size, 3), dtype=np.float32)
            img[:, :, 0] = rng.normal(r_mu, 18, (img_size, img_size)).clip(0, 255) / 255.0
            img[:, :, 1] = rng.normal(g_mu, 18, (img_size, img_size)).clip(0, 255) / 255.0
            img[:, :, 2] = rng.normal(b_mu, 18, (img_size, img_size)).clip(0, 255) / 255.0

            if label_idx == 2:
                # Simulate 1-2 discharge/lesion patches for RED class
                n_patches = rng.integers(1, 3)
                for _ in range(n_patches):
                    cx = rng.integers(6, img_size - 6)
                    cy = rng.integers(6, img_size - 6)
                    radius = rng.integers(3, 7)
                    ys, xs = np.ogrid[:img_size, :img_size]
                    mask = (ys - cy) ** 2 + (xs - cx) ** 2 <= radius ** 2
                    img[mask, 0] = rng.uniform(0.80, 1.00, mask.sum())
                    img[mask, 1] = rng.uniform(0.20, 0.45, mask.sum())
                    img[mask, 2] = rng.uniform(0.10, 0.30, mask.sum())

            images.append(img.transpose(2, 0, 1))   # → CHW
            labels.append(label_idx)

    X = np.array(images, dtype=np.float32)
    y = np.array(labels, dtype=np.int64)

    # Shuffle
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


# ─── Model ────────────────────────────────────────────────────────────────────

class WoundCNN(nn.Module):
    """
    Lightweight 3-class CNN for 32×32 wound images.

    Architecture:
      Conv(3→16) → ReLU → MaxPool   (32 → 16)
      Conv(16→32) → ReLU → MaxPool  (16 → 8)
      Conv(32→64) → ReLU → MaxPool  (8  → 4)
      Flatten → FC(1024→128) → ReLU → Dropout(0.3) → FC(128→3)
    """

    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        flat_size = 64 * (IMG_SIZE // 8) ** 2   # = 64 * 4 * 4 = 1024
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(flat_size, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 3),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


# ─── Training ─────────────────────────────────────────────────────────────────

def train():
    print("=" * 55)
    print(" CareBridge Wound Classifier — Training")
    print("=" * 55)
    print(f"  Image size  : {IMG_SIZE}×{IMG_SIZE}")
    print(f"  Samples/cls : {N_PER_CLASS}  (total {N_PER_CLASS * 3})")
    print(f"  Epochs      : {EPOCHS}")
    print(f"  Batch size  : {BATCH_SIZE}")
    print(f"  Learning rate: {LR}")
    print()

    # ── Data ──────────────────────────────────────────────────────────────────
    print("Generating synthetic wound images…")
    X, y = generate_dataset()

    split = int(0.8 * len(X))
    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]
    print(f"  Train : {len(X_train)} | Val : {len(X_val)}\n")

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds   = TensorDataset(torch.from_numpy(X_val),   torch.from_numpy(y_val))
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE)

    # ── Model, loss, optimiser ────────────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device : {device}\n")

    model = WoundCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)

    # ── Training loop ─────────────────────────────────────────────────────────
    best_val_acc = 0.0
    for epoch in range(1, EPOCHS + 1):
        # --- training ---
        model.train()
        train_loss = 0.0
        train_correct = 0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(xb)
            train_correct += (logits.argmax(1) == yb).sum().item()

        # --- validation ---
        model.eval()
        val_correct = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                val_correct += (model(xb).argmax(1) == yb).sum().item()

        train_acc = train_correct / len(train_ds)
        val_acc   = val_correct   / len(val_ds)
        avg_loss  = train_loss    / len(train_ds)
        print(
            f"  Epoch {epoch:2d}/{EPOCHS}"
            f"  loss={avg_loss:.4f}"
            f"  train_acc={train_acc:.3f}"
            f"  val_acc={val_acc:.3f}"
        )

        # Save best checkpoint
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), SAVE_PATH)

    # ── Results ───────────────────────────────────────────────────────────────
    print()
    print(f"  Best val accuracy : {best_val_acc:.3f}")
    print(f"  Model saved       : {SAVE_PATH}")

    # Save class mapping for reference
    mapping = {"0": "GREEN", "1": "YELLOW", "2": "RED"}
    mapping_path = os.path.join(os.path.dirname(__file__), "class_mapping.json")
    with open(mapping_path, "w") as fh:
        json.dump(mapping, fh, indent=2)
    print(f"  Class mapping     : {mapping_path}")
    print()
    print("  To enable real inference copy the model to ai-service/:")
    print(f"    cp {SAVE_PATH} ../ai-service/wound_classifier.pt")
    print("=" * 55)


if __name__ == "__main__":
    train()
