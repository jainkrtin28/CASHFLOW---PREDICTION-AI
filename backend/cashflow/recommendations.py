import numpy as np
from typing import List, Dict


def generate_improvements(df_cash, forecast: list, metrics: dict) -> List[Dict]:
    improvements = []
    forecast_values = [r["forecast"] for r in forecast]

    # --- Accuracy-based ---
    acc = metrics.get("accuracy_percent", 100)
    if acc < 70:
        improvements.append({
            "priority": "High",
            "category": "Data Quality",
            "title": "Improve Data Completeness",
            "description": f"Model accuracy is {acc:.1f}%. Adding more granular transaction data, seasonal indicators, and external economic factors could raise accuracy above 85%.",
            "expected_impact": "+15-20% accuracy",
            "effort": "Medium",
        })

    # --- Revenue growth ---
    avg_recent = float(df_cash["cashflow"].tail(30).mean())
    avg_forecast = float(np.mean(forecast_values))
    if avg_forecast < avg_recent:
        improvements.append({
            "priority": "High",
            "category": "Revenue",
            "title": "Accelerate Revenue Collection",
            "description": "Forecast shows declining cashflow. Implement early payment incentives (2-5% discount), tighten invoice payment terms from 60 to 30 days, and automate payment reminders.",
            "expected_impact": "+8-12% cashflow",
            "effort": "Low",
        })

    # --- Expense optimization ---
    if df_cash["cashflow"].min() < 0:
        improvements.append({
            "priority": "Medium",
            "category": "Expense Management",
            "title": "Reduce Operating Costs",
            "description": "Audit recurring expenditures. Renegotiate vendor contracts, defer non-critical capital expenditures, and identify top 3 cost centers for 10% reduction target.",
            "expected_impact": "-5-10% costs",
            "effort": "Medium",
        })

    # --- Reserve buffer ---
    monthly_std = float(df_cash.groupby("month")["cashflow"].std().mean())
    if monthly_std > 5000:
        improvements.append({
            "priority": "Medium",
            "category": "Liquidity",
            "title": "Build a 3-Month Cash Reserve",
            "description": f"With ₹{monthly_std:,.0f} monthly volatility, maintain a reserve covering 3× average monthly outflow to avoid short-term liquidity gaps.",
            "expected_impact": "Reduces crisis risk by ~60%",
            "effort": "High",
        })

    # --- Diversification ---
    improvements.append({
        "priority": "Low",
        "category": "Revenue Diversification",
        "title": "Diversify Revenue Streams",
        "description": "Reduce concentration risk by exploring new revenue sources. Even a 15% diversification in revenue can reduce cashflow variance significantly.",
        "expected_impact": "-20% volatility",
        "effort": "High",
    })

    # --- Forecasting cadence ---
    improvements.append({
        "priority": "Low",
        "category": "Process",
        "title": "Weekly Cashflow Reviews",
        "description": "Implement weekly cashflow review meetings comparing actuals vs. forecast. Early variance detection allows 3-4× faster course correction.",
        "expected_impact": "Faster risk mitigation",
        "effort": "Low",
    })

    # --- Positive signals ---
    positives = [r for r in forecast_values if r > 0]
    if len(positives) / len(forecast_values) > 0.7:
        improvements.append({
            "priority": "Low",
            "category": "Growth",
            "title": "Reinvest Positive Cashflow",
            "description": f"{len(positives)/len(forecast_values)*100:.0f}% of forecast days show positive cashflow. Consider structured reinvestment: 60% operations, 30% growth, 10% reserves.",
            "expected_impact": "+10-15% ROI over 12 months",
            "effort": "Medium",
        })

    return improvements
