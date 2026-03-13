import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings("ignore")

BASE_FEATURES = [
    'day', 'month', 'weekday', 'year', 'quarter', 'day_of_month',
    'is_month_end', 'is_month_start', 'is_mid_month',
    'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14', 'lag_30',
    'rolling_avg_7', 'rolling_avg_14', 'rolling_avg_30',
    'rolling_std_7', 'rolling_std_30',
    'month_avg', 'weekday_avg'
]

IN_FEATURES  = [f'in_{f}'  for f in BASE_FEATURES]
OUT_FEATURES = [f'out_{f}' for f in BASE_FEATURES]


def train_model(df_cash: pd.DataFrame):
    split = int(len(df_cash) * 0.8)
    train = df_cash.iloc[:split]
    test  = df_cash.iloc[split:]

    model_in = GradientBoostingRegressor(
        n_estimators=500, learning_rate=0.03, max_depth=5,
        subsample=0.8, random_state=42
    )
    model_out = GradientBoostingRegressor(
        n_estimators=500, learning_rate=0.03, max_depth=5,
        subsample=0.8, random_state=42
    )

    # Train on IN_FEATURES and OUT_FEATURES (the prefixed column names)
    model_in.fit(train[IN_FEATURES],   train['inflow'])
    model_out.fit(train[OUT_FEATURES], train['outflow'])

    model = _DualModel(model_in, model_out)
    return model, test, test['cashflow']


class _DualModel:
    def __init__(self, model_in, model_out):
        self.model_in  = model_in
        self.model_out = model_out

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        # X must have IN_FEATURES and OUT_FEATURES columns
        pred_in  = self.model_in.predict(X[IN_FEATURES])
        pred_out = self.model_out.predict(X[OUT_FEATURES])
        return pred_in - pred_out


def compute_accuracy_metrics(model, X_test, y_test):
    preds = model.predict(X_test)
    y     = y_test.values if hasattr(y_test, 'values') else np.array(y_test)

    mae  = float(mean_absolute_error(y, preds))
    rmse = float(np.sqrt(mean_squared_error(y, preds)))
    r2   = float(r2_score(y, preds))

    threshold = max(np.percentile(np.abs(y), 25), 1.0)
    mask = np.abs(y) > threshold
    if mask.sum() > 0:
        mape = float(np.mean(np.abs((y[mask] - preds[mask]) / y[mask])) * 100)
        mape = min(mape, 100.0)
    else:
        mape = 0.0

    r2_accuracy   = max(0.0, min(100.0, round(r2 * 100, 2)))
    mape_accuracy = max(0.0, round(100 - mape, 2))
    accuracy_pct  = round(r2_accuracy * 0.6 + mape_accuracy * 0.4, 2)

    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "mape": round(mape, 2),
        "accuracy_percent": accuracy_pct
    }


def compute_monthly_accuracy(df_cash: pd.DataFrame, model) -> list:
    results = []
    df_cash = df_cash.copy()
    df_cash["year_month"] = df_cash["date"].dt.to_period("M")

    for period, grp in df_cash.groupby("year_month"):
        if len(grp) < 3:
            continue

        preds = model.predict(grp)
        y_m   = grp["cashflow"].values

        actual_sum    = float(y_m.sum())
        predicted_sum = float(preds.sum())
        mae           = float(mean_absolute_error(y_m, preds))

        if abs(actual_sum) > 1.0:
            err      = min(abs(actual_sum - predicted_sum) / abs(actual_sum) * 100, 100.0)
            accuracy = max(0.0, round(100 - err, 2))
        else:
            accuracy = 100.0 if abs(predicted_sum) < 500 else 0.0

        results.append({
            "month":         str(period),
            "accuracy":      accuracy,
            "mae":           round(mae, 2),
            "actual_sum":    round(actual_sum, 2),
            "predicted_sum": round(predicted_sum, 2),
        })

    return results


def forecast_future(df_cash: pd.DataFrame, model, days: int = 90) -> list:
    from cashflow.data_processing import build_features  # BASE_FEATURES is already in this file

    last_date    = df_cash['date'].iloc[-1]
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=days, freq='D')

    in_baseline  = float(df_cash['inflow'].rolling(30, min_periods=1).mean().iloc[-1])
    out_baseline = float(df_cash['outflow'].rolling(30, min_periods=1).mean().iloc[-1])
    in_std       = float(df_cash['inflow'].std())
    out_std      = float(df_cash['outflow'].std())

    # Extend series: historical + flat forecast baseline
    all_dates  = pd.DatetimeIndex(
        df_cash['date'].tolist() + future_dates.tolist()
    )
    in_vals    = np.concatenate([df_cash['inflow'].values,  np.full(days, in_baseline)])
    out_vals   = np.concatenate([df_cash['outflow'].values, np.full(days, out_baseline)])

    full_idx   = pd.date_range(all_dates[0], all_dates[-1], freq='D')
    in_series  = pd.Series(in_vals,  index=all_dates).reindex(full_idx, fill_value=0)
    out_series = pd.Series(out_vals, index=all_dates).reindex(full_idx, fill_value=0)

    in_feat  = build_features(in_series,  full_idx)
    out_feat = build_features(out_series, full_idx)

    future_mask = full_idx >= future_dates[0]

    # Build a combined dataframe with IN_FEATURES and OUT_FEATURES columns
    # exactly matching what the model was trained on
    forecast_df = pd.DataFrame(index=np.where(future_mask)[0])
    for f in BASE_FEATURES:
        forecast_df[f'in_{f}']  = in_feat.loc[future_mask,  f].values
        forecast_df[f'out_{f}'] = out_feat.loc[future_mask, f].values

    pred_in  = model.model_in.predict(forecast_df[IN_FEATURES])
    pred_out = model.model_out.predict(forecast_df[OUT_FEATURES])
    preds    = pred_in - pred_out

    results = []
    for i, (d, pred) in enumerate(zip(future_dates, preds)):
        confidence = max(0.3, 1 - (i / days) * 0.5)
        margin     = (in_std + out_std) * (1 + i / days) * 0.5
        results.append({
            "date":       d.strftime("%Y-%m-%d"),
            "forecast":   round(float(pred), 2),
            "lower":      round(float(pred - margin), 2),
            "upper":      round(float(pred + margin), 2),
            "confidence": round(confidence, 2),
        })

    return results