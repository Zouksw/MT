"""Deep learning models — Timer-XL (LSTM) and Sundial (Transformer)."""

import numpy as np
import torch
import torch.nn as nn

from config import settings


# --- Timer-XL: LSTM-based forecaster ---

class LSTMForecaster(nn.Module):
    def __init__(self, input_size: int = 1, hidden_size: int = 64, num_layers: int = 2):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size, device=x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size, device=x.device)
        out, _ = self.lstm(x, (h0, c0))
        return self.fc(out[:, -1, :])


# --- Sundial: Transformer-based forecaster ---

class TransformerForecaster(nn.Module):
    def __init__(self, input_size: int = 1, d_model: int = 64, nhead: int = 4, num_layers: int = 2):
        super().__init__()
        self.d_model = d_model
        self.input_proj = nn.Linear(input_size, d_model)
        encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, batch_first=True)
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.fc = nn.Linear(d_model, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.input_proj(x)
        x = self.encoder(x)
        return self.fc(x[:, -1, :])


def _train_and_predict(
    model: nn.Module,
    values: list[float],
    horizon: int,
    epochs: int = 50,
    lr: float = 0.01,
    confidence_level: float = 0.95,
) -> dict:
    """Train model on values, then autoregressive predict."""
    device = torch.device("cpu")
    model = model.to(device)
    model.train()

    arr = np.array(values, dtype=np.float32)
    if len(arr) < 3:
        last = arr[-1] if len(arr) > 0 else 0.0
        pad = [last] * horizon
        return {"values": pad, "lower_bound": pad, "upper_bound": pad}

    # Normalize
    mean, std = arr.mean(), arr.std()
    if std < 1e-8:
        std = 1.0
    arr_norm = (arr - mean) / std

    # Build sliding windows
    window = min(10, len(arr_norm) - 1)
    X, y = [], []
    for i in range(len(arr_norm) - window):
        X.append(arr_norm[i : i + window])
        y.append(arr_norm[i + window])
    if not X:
        # Fallback: use all as one sample
        X.append(arr_norm[:-1])
        y.append(arr_norm[-1])

    X_arr = np.array(X, dtype=np.float32)
    y_arr = np.array(y, dtype=np.float32)
    X_t = torch.from_numpy(X_arr).unsqueeze(-1).to(device)
    y_t = torch.from_numpy(y_arr).unsqueeze(-1).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    for _ in range(epochs):
        optimizer.zero_grad()
        pred = model(X_t)
        loss = loss_fn(pred, y_t)
        loss.backward()
        optimizer.step()

    # Autoregressive prediction
    model.eval()
    with torch.no_grad():
        seq = arr_norm[-window:].tolist()
        predictions = []
        for _ in range(horizon):
            inp = torch.tensor([seq[-window:]], dtype=torch.float32).unsqueeze(-1).to(device)
            p = model(inp).item()
            predictions.append(p)
            seq.append(p)

    pred_arr = np.array(predictions) * std + mean

    # Confidence: scale residual error
    model.eval()
    with torch.no_grad():
        train_pred = model(X_t).squeeze(-1).cpu().numpy()
    residuals = y_t.squeeze(-1).cpu().numpy() - train_pred
    err_std = max(np.std(residuals) * std, 0.01)
    z = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}.get(confidence_level, 1.96)
    margin = z * err_std * np.sqrt(np.arange(1, horizon + 1))

    return {
        "values": pred_arr.tolist(),
        "lower_bound": (pred_arr - margin).tolist(),
        "upper_bound": (pred_arr + margin).tolist(),
    }


def predict_timer_xl(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    model = LSTMForecaster(
        hidden_size=settings.lstm_hidden_size,
        num_layers=settings.lstm_num_layers,
    )
    return _train_and_predict(model, values, horizon, epochs=50, confidence_level=confidence_level)


def predict_sundial(
    values: list[float],
    horizon: int,
    confidence_level: float = 0.95,
) -> dict:
    model = TransformerForecaster(
        d_model=settings.transformer_d_model,
        nhead=settings.transformer_nhead,
        num_layers=settings.transformer_num_layers,
    )
    return _train_and_predict(model, values, horizon, epochs=50, confidence_level=confidence_level)


DEEP_MODELS = {
    "timer_xl": predict_timer_xl,
    "sundial": predict_sundial,
}
