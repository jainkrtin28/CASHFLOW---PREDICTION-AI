# 💰 CashFlow AI Pro
### Intelligent Cashflow Forecasting Dashboard

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0.3-lightgrey?style=flat-square&logo=flask)
![Scikit-learn](https://img.shields.io/badge/Scikit--learn-1.5.1-orange?style=flat-square&logo=scikit-learn)
![Chart.js](https://img.shields.io/badge/Chart.js-4.x-ff6384?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)

> AI-powered cashflow forecasting dashboard — upload your transaction CSV, auto-trains a dual ML model, predicts daily & monthly profit/loss up to 6 months ahead, detects financial risks & generates recommendations.

---

## 📌 What Is CashFlow AI Pro?

CashFlow AI Pro is a self-hosted web application that takes your raw transaction data (inflows and outflows) and turns it into an intelligent financial dashboard. It trains a machine learning model on your historical cashflow, predicts the future, detects financial risks, and gives you actionable recommendations — all running locally on your own machine with no third-party data sharing.

Built for small business owners, finance teams, and developers who want a real AI-powered cashflow tool without paying for expensive SaaS subscriptions.

---

## 🛠️ Technology Stack

| Technology | Description |
|---|---|
| **Flask (Python)** | Backend web server — serves the dashboard and all API endpoints |
| **Scikit-learn GBR** | Dual Gradient Boosting Regressor — one model for inflows, one for outflows |
| **Pandas / NumPy** | Data loading, feature engineering, and time-series processing |
| **Chart.js** | Interactive charts rendered in the browser — bars, lines, pie, annotations |
| **Vanilla JavaScript** | Frontend dashboard logic, tab navigation, API calls, real-time data entry |
| **Docker + Nginx** | Production deployment — containerised app behind a reverse proxy |
| **Gunicorn** | WSGI production server — 2 workers, 120s timeout |

---

## 🤖 How the AI Model Works

The model uses a **Dual Gradient Boosting Regressor (GBR)** architecture — two completely separate models trained independently:

- `model_in` → predicts daily **inflow** (money coming in)
- `model_out` → predicts daily **outflow** (money going out)
- **Net cashflow forecast = predicted inflow − predicted outflow**

This dual-model approach is the key design decision. Predicting net cashflow directly gives ~38% accuracy because inflows and outflows have completely different patterns. Outflows are regular (rent, salaries on fixed days), while inflows are seasonal and irregular. Training separate models and subtracting gives **~83% monthly accuracy**.

### Feature Engineering (22 features per model)

| Feature | Description |
|---|---|
| `day, year, month, quarter` | Calendar position of the day |
| `weekday, day_of_month` | Day-of-week and day-of-month patterns |
| `is_month_start/end/mid` | Binary flags for special billing dates |
| `lag_1, lag_2, lag_3` | Value from 1, 2, 3 days ago |
| `lag_7, lag_14, lag_30` | Value from 1 week, 2 weeks, 1 month ago |
| `rolling_avg_7/14/30` | 7, 14 and 30-day rolling averages |
| `rolling_std_7/30` | Rolling standard deviation (volatility) |
| `month_avg, weekday_avg` | Seasonal baseline — average for this month / weekday across all history |

### Model Hyperparameters

```python
GradientBoostingRegressor(
    n_estimators  = 500,   # 500 trees
    learning_rate = 0.03,  # small steps for better generalisation
    max_depth     = 5,     # prevents overfitting
    subsample     = 0.8,   # 80% of data per tree (stochastic GBR)
    random_state  = 42
)
```

### Accuracy Measurement

Accuracy is computed as a blended score: **60% × R²-based accuracy + 40% × MAPE-based accuracy**. MAPE is calculated only on rows where `|actual| > 25th percentile`, to avoid division by near-zero values causing misleading readings.

---

## 📁 Project Structure

```
cashflow-pro/
├── backend/
│   ├── app.py                    ← Flask app, all API routes
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── data/
│   │   └── cashflow_dataset.csv  ← Your transaction data
│   ├── cashflow/
│   │   ├── data_processing.py    ← CSV loading, feature engineering
│   │   ├── model.py              ← Dual GBR model, forecast, metrics
│   │   ├── risk_analysis.py      ← 5 risk detectors
│   │   └── recommendations.py   ← AI improvement suggestions
│   ├── templates/
│   │   └── dashboard.html        ← Single-page dashboard
│   └── static/
│       ├── css/style.css         ← Dark theme, all component styles
│       └── js/dashboard.js       ← All frontend logic
├── docker-compose.yml
└── nginx.conf
```

---

## 📊 Dashboard Tabs

### 1. 🏠 Overview
The landing page. Shows the most important numbers at a glance:
- Total Inflow, Total Outflow, Net Cashflow (all time)
- Model accuracy percentage with MAE, RMSE, R², MAPE
- Historical cashflow chart — last 365 days with 7-day and 30-day rolling averages
- Monthly cashflow bar chart — which months were profitable vs. loss

### 2. 📈 Forecast
The core prediction tab. Switch between 1, 2, 3 or 6 month horizons:
- Daily bar chart — green bars are profit days, red bars are loss days
- Shaded confidence band — grows wider further into the future
- Dashed trend line — smoothed direction of the forecast
- Monthly Profit/Loss table — Verdict, Net Cashflow, Profit Day Rate, Scenario Range, Confidence score

### 3. 🎯 Accuracy
Shows how well the model performed on historical data:
- Month-by-month accuracy line chart
- Actual vs. Predicted bar chart
- Accuracy metrics table — month, accuracy %, MAE, actual total, predicted total

### 4. ⚠️ Risk Analysis
Automatically detects 5 types of financial risk:
- **Cashflow Deficit Risk** — if >50% of forecast days are negative → Critical alert
- **Volatility Risk** — measures coefficient of variation (std/mean) of recent 60 days
- **Declining Trend Risk** — compares first-half vs second-half of the forecast period
- **Seasonal Risk** — identifies months with historically high variance
- **Liquidity Risk** — flags if worst-case forecast drops below ₹50,000

Each risk is rated **Critical / High / Medium / Low** with impact, probability, and description. An overall risk score (0–100) is shown at the top.

### 5. 💡 Improvements
AI-generated financial improvement suggestions based on your actual data:
- Data Quality, Revenue Acceleration, Expense Optimisation
- Cash Reserve recommendations based on your actual volatility
- Revenue Diversification, Weekly Reviews, Reinvestment Strategy

### 6. 🗂️ Category Breakdown
- Top 10 inflow categories by total amount
- Top 10 outflow categories by total amount
- Horizontal bar charts with exact totals

### 7. ➕ Add Data
Real-time data entry — add new transactions without touching any files:
- **Single Entry Form** — Date, Type, Category, Amount → stages in memory
- **Staged Entries Table** — review/delete before committing
- **Save All** → appends to CSV and retrains the model immediately
- **Bulk CSV Upload** — drag and drop any CSV; column names are auto-detected

---

## 🔌 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serves the dashboard HTML |
| `/api/overview` | GET | Total inflow/outflow, net cashflow, date range, accuracy metrics |
| `/api/forecast?days=N` | GET | N-day forecast (7–365). Returns date, forecast, lower, upper, confidence |
| `/api/historical` | GET | Last 365 days of actual cashflow with rolling averages |
| `/api/monthly-summary` | GET | Monthly totals: sum, mean, std, min, max |
| `/api/monthly-accuracy` | GET | Per-month accuracy, MAE, actual_sum, predicted_sum |
| `/api/categories` | GET | Top 10 inflow and outflow categories |
| `/api/risks` | GET | Risk analysis with level, title, description, overall score |
| `/api/improvements` | GET | Improvement recommendations with priority, effort, expected impact |
| `/api/add-entry` | POST | Add single transaction. Body: `{date, type, category, amount}` |
| `/api/upload-csv` | POST | Upload CSV file (any column names). Appends and retrains. |
| `/api/health` | GET | Health check: `{status: ok, model: GBR Dual Model}` |

---

## 🚀 Setup & Installation

### Option A — Run Locally (Python)

**Prerequisites:** Python 3.10+

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/cashflow-ai-pro.git
cd cashflow-ai-pro/backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Add your CSV data
# Place your file at: data/cashflow_dataset.csv

# 4. Start the server
python app.py
```

Open your browser at **http://localhost:5000**

### Option B — Docker (Recommended for Production)

```bash
git clone https://github.com/YOUR_USERNAME/cashflow-ai-pro.git
cd cashflow-ai-pro
docker-compose up --build
```

The app runs on **http://localhost:80** behind Nginx. The data folder is mounted as a volume so your CSV persists between restarts.

---

## 📄 CSV Data Format

Your CSV needs four types of columns. **Column names can be anything** — the system auto-detects which column is which:

| Column | Description |
|---|---|
| **Date** | Any format: `2025-01-15`, `15/01/2025`, `Jan 15 2025` |
| **Type** | Values like: `Inflow/Outflow`, `Income/Expense`, `Credit/Debit` |
| **Category** | Free text: `Sales Revenue`, `Office Rent`, `Maintenance` |
| **Amount** | Numeric values. Symbols like ₹, $, commas are stripped automatically |

**Standard format:**
```csv
DATE,TYPE,CATEGORY,AMOUNT
2025-01-01,Inflow,Sales Revenue,5000
2025-01-01,Outflow,Office Rent,1200
2025-01-02,Inflow,Consulting,3500
```

**Custom column names also work:**
```csv
Transaction Date,Flow Direction,Description,Value
2025-01-01,income,Client Payment,5000
2025-01-01,expense,Rent,1200
```

---

## 📦 Python Dependencies

| Package | Version | Purpose |
|---|---|---|
| Flask | 3.0.3 | Web framework — routes, templates, JSON responses |
| flask-cors | 4.0.1 | Allows the frontend to call the API from any origin |
| pandas | 2.2.2 | Data loading, groupby aggregation, time-series resampling |
| numpy | 1.26.4 | Numerical operations, array manipulation |
| scikit-learn | 1.5.1 | GradientBoostingRegressor, train_test_split, metrics |
| xgboost | 2.1.1 | Listed in requirements (available for future model upgrades) |
| gunicorn | 22.0.0 | Production WSGI server used inside Docker |

---

## 📜 License

MIT License — free to use, modify and distribute.

---

*Built with Python, Flask, and Scikit-learn*