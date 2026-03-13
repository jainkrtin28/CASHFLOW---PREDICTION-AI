from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import numpy as np
import logging

from cashflow.data_processing import prepare_data, get_category_breakdown, get_monthly_summary
from cashflow.model import train_model, compute_accuracy_metrics, compute_monthly_accuracy, forecast_future
from cashflow.risk_analysis import analyze_risks
from cashflow.recommendations import generate_improvements

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

DATA_PATH = "data/cashflow_dataset.csv"

logger.info("Loading and processing data...")
df_cash = prepare_data(DATA_PATH)

logger.info("Training model...")
model, X_test, y_test = train_model(df_cash)

logger.info("Computing metrics...")
metrics = compute_accuracy_metrics(model, X_test, y_test)
monthly_accuracy = compute_monthly_accuracy(df_cash, model)
monthly_summary = get_monthly_summary(df_cash)
categories = get_category_breakdown(DATA_PATH)

total_inflow = float(df_cash[df_cash["cashflow"] > 0]["cashflow"].sum())
total_outflow = float(abs(df_cash[df_cash["cashflow"] < 0]["cashflow"].sum()))
net_cashflow = total_inflow - total_outflow

# Pre-compute 90-day forecast
forecast_90 = forecast_future(df_cash, model, days=90)
risks = analyze_risks(df_cash, forecast_90)
improvements = generate_improvements(df_cash, forecast_90, metrics)

logger.info("App ready.")


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


@app.route("/api/overview")
def overview():
    return jsonify({
        "total_inflow": round(total_inflow, 2),
        "total_outflow": round(total_outflow, 2),
        "net_cashflow": round(net_cashflow, 2),
        "data_points": len(df_cash),
        "date_range": {
            "start": df_cash["date"].min().strftime("%Y-%m-%d"),
            "end": df_cash["date"].max().strftime("%Y-%m-%d"),
        },
        "metrics": metrics,
    })


@app.route("/api/forecast")
def forecast():
    days = int(request.args.get("days", 90))
    days = min(max(days, 7), 365)
    result = forecast_future(df_cash, model, days=days)
    return jsonify(result)


@app.route("/api/historical")
def historical():
    data = df_cash[["date", "cashflow", "rolling_avg_7", "rolling_avg_30"]].copy()
    data["date"] = data["date"].dt.strftime("%Y-%m-%d")
    return jsonify(data.tail(365).to_dict(orient="records"))


@app.route("/api/monthly-accuracy")
def monthly_accuracy_route():
    return jsonify(monthly_accuracy)


@app.route("/api/monthly-summary")
def monthly_summary_route():
    return jsonify(monthly_summary)


@app.route("/api/risks")
def risks_route():
    return jsonify(risks)


@app.route("/api/improvements")
def improvements_route():
    return jsonify(improvements)


@app.route("/api/categories")
def categories_route():
    return jsonify(categories)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model": "GBR Dual Model"})


@app.route("/api/add-entry", methods=["POST"])
def add_entry():
    """Append a single transaction row to the CSV, then retrain."""
    global df_cash, model, X_test, y_test, metrics, monthly_accuracy, monthly_summary, categories, forecast_90, risks, improvements, total_inflow, total_outflow, net_cashflow
    try:
        body = request.get_json()
        date     = body.get("date", "").strip()
        typ      = body.get("type", "").strip()
        category = body.get("category", "").strip()
        amount   = float(body.get("amount", 0))

        if not date or typ not in ("Inflow", "Outflow") or not category or amount <= 0:
            return jsonify({"success": False, "error": "Invalid input. Check all fields."}), 400

        import pandas as pd, os
        # Append to CSV
        new_row = pd.DataFrame([{"DATE": date, "TYPE": typ, "CATEGORY": category, "AMOUNT": amount}])
        header  = not os.path.exists(DATA_PATH)
        new_row.to_csv(DATA_PATH, mode="a", header=header, index=False)

        # Retrain
        _retrain()
        return jsonify({"success": True, "message": f"Entry added and model retrained."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/upload-csv", methods=["POST"])
def upload_csv():
    """Replace or append a CSV file, then retrain."""
    global df_cash, model, X_test, y_test, metrics, monthly_accuracy, monthly_summary, categories, forecast_90, risks, improvements, total_inflow, total_outflow, net_cashflow
    try:
        import pandas as pd, io
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file sent."}), 400

        f    = request.files["file"]
        mode = request.form.get("mode", "append")   # "append" or "replace"

        for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                new_df = pd.read_csv(io.StringIO(f.stream.read().decode(enc)))
                break
            except Exception:
                f.stream.seek(0)

        # Normalise column names
        new_df.columns = [
            "".join(ch for ch in c if ch.isprintable() and ord(ch) < 128).strip().upper()
            for c in new_df.columns
        ]
        required = {"DATE", "TYPE", "CATEGORY", "AMOUNT"}
        if not required.issubset(set(new_df.columns)):
            return jsonify({"success": False, "error": f"Missing columns. Found: {list(new_df.columns)}"}), 400

        if mode == "replace":
            new_df.to_csv(DATA_PATH, index=False)
        else:
            existing = pd.read_csv(DATA_PATH) if __import__("os").path.exists(DATA_PATH) else pd.DataFrame()
            pd.concat([existing, new_df], ignore_index=True).to_csv(DATA_PATH, index=False)

        rows = len(new_df)
        _retrain()
        return jsonify({"success": True, "message": f"{rows} rows uploaded, model retrained."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _retrain():
    """Reload data and retrain all globals in-place."""
    global df_cash, model, X_test, y_test, metrics, monthly_accuracy, monthly_summary, categories, forecast_90, risks, improvements, total_inflow, total_outflow, net_cashflow
    df_cash          = prepare_data(DATA_PATH)
    model, X_test, y_test = train_model(df_cash)
    metrics          = compute_accuracy_metrics(model, X_test, y_test)
    monthly_accuracy = compute_monthly_accuracy(df_cash, model)
    monthly_summary  = get_monthly_summary(df_cash)
    categories       = get_category_breakdown(DATA_PATH)
    total_inflow     = float(df_cash[df_cash["cashflow"] > 0]["cashflow"].sum())
    total_outflow    = float(abs(df_cash[df_cash["cashflow"] < 0]["cashflow"].sum()))
    net_cashflow     = total_inflow - total_outflow
    forecast_90      = forecast_future(df_cash, model, days=90)
    risks            = analyze_risks(df_cash, forecast_90)
    improvements     = generate_improvements(df_cash, forecast_90, metrics)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)