import numpy as np
import pandas as pd
from typing import List, Dict


def analyze_risks(df_cash: pd.DataFrame, forecast: list) -> Dict:
    risks = []
    score = 0  # 0-100 overall risk score

    # --- 1. Negative cashflow risk ---
    negatives = [r for r in forecast if r["forecast"] < 0]
    neg_pct = len(negatives) / len(forecast) * 100 if forecast else 0
    if neg_pct > 50:
        risks.append({
            "id": "neg_cashflow",
            "level": "Critical",
            "title": "Severe Cashflow Deficit",
            "description": f"{neg_pct:.0f}% of forecast days show negative cashflow. Immediate action required.",
            "impact": "High",
            "probability": "High",
        })
        score += 35
    elif neg_pct > 20:
        risks.append({
            "id": "neg_cashflow",
            "level": "High",
            "title": "Recurring Cashflow Deficits",
            "description": f"{neg_pct:.0f}% of forecast days are negative. Monitor closely.",
            "impact": "High",
            "probability": "Medium",
        })
        score += 20

    # --- 2. Volatility risk ---
    recent = df_cash["cashflow"].tail(60)
    std = float(recent.std())
    mean = float(recent.mean())
    cv = abs(std / mean) if mean != 0 else 0
    if cv > 2:
        risks.append({
            "id": "volatility",
            "level": "High",
            "title": "High Cashflow Volatility",
            "description": f"Coefficient of variation is {cv:.2f}x — extreme swings in cashflow detected.",
            "impact": "Medium",
            "probability": "High",
        })
        score += 20
    elif cv > 1:
        risks.append({
            "id": "volatility",
            "level": "Medium",
            "title": "Moderate Cashflow Volatility",
            "description": f"Significant fluctuations in recent cashflow (CV = {cv:.2f}).",
            "impact": "Medium",
            "probability": "Medium",
        })
        score += 10

    # --- 3. Declining trend risk ---
    if len(forecast) >= 10:
        first_half = np.mean([r["forecast"] for r in forecast[:len(forecast)//2]])
        second_half = np.mean([r["forecast"] for r in forecast[len(forecast)//2:]])
        decline_pct = (first_half - second_half) / abs(first_half) * 100 if first_half != 0 else 0
        if decline_pct > 20:
            risks.append({
                "id": "trend_decline",
                "level": "High",
                "title": "Declining Revenue Trend",
                "description": f"Forecast shows {decline_pct:.1f}% drop in the second half of the period.",
                "impact": "High",
                "probability": "Medium",
            })
            score += 20
        elif decline_pct > 10:
            risks.append({
                "id": "trend_decline",
                "level": "Medium",
                "title": "Slight Revenue Softening",
                "description": f"Cashflow trending {decline_pct:.1f}% lower in later forecast period.",
                "impact": "Medium",
                "probability": "Low",
            })
            score += 10

    # --- 4. Seasonal risk ---
    monthly_std = df_cash.groupby("month")["cashflow"].std()
    high_var_months = monthly_std[monthly_std > monthly_std.mean() * 1.5].index.tolist()
    if high_var_months:
        month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        names = [month_names[m-1] for m in high_var_months]
        risks.append({
            "id": "seasonal",
            "level": "Low",
            "title": "Seasonal Cashflow Patterns",
            "description": f"High variability detected in: {', '.join(names)}. Plan reserves accordingly.",
            "impact": "Low",
            "probability": "High",
        })
        score += 5

    # --- 5. Liquidity risk ---
    min_forecast = min([r["forecast"] for r in forecast], default=0)
    if min_forecast < -50000:
        risks.append({
            "id": "liquidity",
            "level": "Critical",
            "title": "Liquidity Crisis Risk",
            "description": f"Worst-case forecast: ₹{min_forecast:,.0f}. Emergency reserves may be needed.",
            "impact": "High",
            "probability": "Medium",
        })
        score += 25

    overall_level = "Low"
    if score >= 60:
        overall_level = "Critical"
    elif score >= 40:
        overall_level = "High"
    elif score >= 20:
        overall_level = "Medium"

    return {
        "risks": risks,
        "risk_score": min(score, 100),
        "overall_level": overall_level,
    }
