"""Train SkyFare's fare-prediction model and export it to JSON.

    npm run data              # writes ml/data/fare_history.csv
    python3 ml/train_model.py # trains, evaluates and exports

What it does
------------
1. Loads the simulated 12-month fare history (one observed fare per route,
   departure day and time-of-day bucket, quoted 0-120 days ahead).
2. Holds out a random 20% test split (seed 42).
3. Trains three models on log(price):
     * a naive baseline (average fare per route),
     * a RandomForestRegressor (comparison only),
     * a GradientBoostingRegressor  <- the model that is served.
4. Reports MAE (INR), RMSE, MAPE and R^2 on the held-out test set.
5. Exports the gradient-boosted trees to src/data/ml/fare-model.json so the
   Next.js API routes can run predictions in TypeScript (no Python on Vercel),
   plus src/data/ml/insights.json with the dashboard / About page statistics.

Only numpy and scikit-learn are required (see ml/requirements.txt).
"""

from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

import numpy as np
import sklearn
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data" / "fare_history.csv"
OUT_DIR = ROOT / "src" / "data" / "ml"
SEED = 42

# Feature order comes from the CSV header (written by src/lib/ml/features.ts).
META_COLS = ["route", "departure_date", "booking_date", "time_bucket", "airline", "stops"]
FEATURE_LABELS = {
    "origin_idx": "Origin airport",
    "dest_idx": "Destination airport",
    "distance_km": "Route distance",
    "is_domestic": "Domestic route",
    "is_long_haul": "Long-haul route",
    "origin_region": "Origin region",
    "dest_region": "Destination region",
    "dest_kind": "Destination type",
    "origin_pop": "Origin popularity",
    "dest_pop": "Destination popularity",
    "days_before": "Days before departure",
    "day_of_week": "Day of week",
    "month": "Month (season)",
    "is_holiday": "Holiday period",
    "holiday_importance": "Holiday importance",
    "days_to_holiday": "Days to holiday",
    "time_of_day": "Time of day",
}


def load():
    if not DATA.exists():
        sys.exit(f"Missing {DATA}. Run `npm run data` first.")
    with DATA.open(newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    feat_names = [c for c in header if c not in META_COLS and c != "price"]
    idx = {c: i for i, c in enumerate(header)}
    X = np.array([[float(r[idx[c]]) for c in feat_names] for r in rows], dtype=np.float64)
    y = np.array([float(r[idx["price"]]) for r in rows], dtype=np.float64)
    meta = {c: [r[idx[c]] for r in rows] for c in META_COLS}
    return feat_names, X, y, meta


def metrics(y_true, y_pred):
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 1),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 1),
        "mape": round(float(np.mean(np.abs(y_pred - y_true) / y_true) * 100), 2),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def export_gbm(model: GradientBoostingRegressor, feat_names):
    trees = []
    for est in model.estimators_[:, 0]:
        t = est.tree_
        leaf = t.children_left == -1
        trees.append(
            {
                "f": [int(v) if not l else -1 for v, l in zip(t.feature, leaf)],
                "t": [round(float(v), 5) if not l else 0 for v, l in zip(t.threshold, leaf)],
                "l": [int(v) for v in t.children_left],
                "r": [int(v) for v in t.children_right],
                "v": [round(float(v), 6) if l else 0 for v, l in zip(t.value[:, 0, 0], leaf)],
            }
        )
    init = float(model.init_.constant_[0][0]) if hasattr(model.init_, "constant_") else float(model._raw_predict_init(np.zeros((1, len(feat_names))))[0][0])
    return {"init": init, "learningRate": float(model.learning_rate), "trees": trees}


def group_mean(keys, values):
    out = {}
    for k, v in zip(keys, values):
        s = out.setdefault(k, [0.0, 0])
        s[0] += v
        s[1] += 1
    return {k: s[0] / s[1] for k, s in out.items()}


def build_insights(feat_names, X, y, meta):
    fi = {n: i for i, n in enumerate(feat_names)}
    dom = X[:, fi["is_domestic"]] == 1
    # Normalise each fare by its route's average so routes of different
    # lengths can be compared on one "price index" scale.
    route_avg = group_mean(meta["route"], y)
    index = np.array([p / route_avg[r] for p, r in zip(y, meta["route"])])

    months = [d[:7] for d in meta["departure_date"]]
    monthly = []
    for m in sorted(set(months)):
        mask = np.array([mm == m for mm in months])
        monthly.append(
            {
                "month": m,
                "domestic": int(round(float(np.mean(y[mask & dom])))),
                "international": int(round(float(np.mean(y[mask & ~dom])))),
                "index": round(float(np.mean(index[mask])), 4),
            }
        )

    lead = X[:, fi["days_before"]]
    lead_bins = [(0, 2, "0-2"), (3, 6, "3-6"), (7, 13, "7-13"), (14, 20, "14-20"), (21, 34, "21-34"), (35, 55, "35-55"), (56, 89, "56-89"), (90, 120, "90-120")]
    lead_curve = []
    for lo, hi, label in lead_bins:
        mask = (lead >= lo) & (lead <= hi)
        lead_curve.append({"bucket": label, "from": lo, "to": hi, "index": round(float(np.mean(index[mask])), 4), "rows": int(mask.sum())})

    dow = X[:, fi["day_of_week"]]
    dow_curve = [{"day": d, "index": round(float(np.mean(index[dow == d])), 4)} for d in range(7)]
    tod = X[:, fi["time_of_day"]]
    tod_names = ["early", "morning", "afternoon", "evening", "night"]
    tod_curve = [{"bucket": tod_names[b], "index": round(float(np.mean(index[tod == b])), 4)} for b in range(5)]
    month_curve = [{"month": m, "index": round(float(np.mean(index[X[:, fi["month"]] == m])), 4)} for m in range(1, 13)]
    hol = X[:, fi["is_holiday"]] == 1
    stops = np.array([int(s) for s in meta["stops"]])
    return {
        "monthlyAverages": monthly,
        "leadTimeCurve": lead_curve,
        "dayOfWeekCurve": dow_curve,
        "timeOfDayCurve": tod_curve,
        "monthCurve": month_curve,
        "holidayPremiumPct": round(float((np.mean(index[hol]) / np.mean(index[~hol]) - 1) * 100), 1),
        "nonstopPremiumPct": round(float((np.mean(index[stops == 0]) / np.mean(index[stops > 0]) - 1) * 100), 1),
        "avgDomesticFare": int(round(float(np.mean(y[dom])))),
        "avgInternationalFare": int(round(float(np.mean(y[~dom])))),
    }


def main():
    t0 = time.time()
    feat_names, X, y, meta = load()
    n = len(y)
    print(f"Loaded {n:,} rows x {len(feat_names)} features in {time.time() - t0:.1f}s")

    rng = np.random.default_rng(SEED)
    perm = rng.permutation(n)
    n_test = int(n * 0.2)
    test_idx, train_idx = perm[:n_test], perm[n_test:]
    Xtr, Xte, ytr, yte = X[train_idx], X[test_idx], y[train_idx], y[test_idx]
    ltr = np.log(ytr)

    results = {}

    # 1) Baseline: average fare per route.
    routes = np.array(meta["route"])
    route_mean = group_mean(routes[train_idx], ytr)
    overall = float(np.mean(ytr))
    base_pred = np.array([route_mean.get(r, overall) for r in routes[test_idx]])
    results["baseline"] = metrics(yte, base_pred)
    print("baseline", results["baseline"])

    # 2) Random forest (comparison).
    t = time.time()
    rf = RandomForestRegressor(n_estimators=60, max_depth=18, min_samples_leaf=3, max_samples=0.5, n_jobs=-1, random_state=SEED)
    rf.fit(Xtr, ltr)
    results["randomForest"] = metrics(yte, np.exp(rf.predict(Xte)))
    results["randomForest"]["trainSeconds"] = round(time.time() - t, 1)
    print("random forest", results["randomForest"])

    # 3) Gradient boosting (served).
    t = time.time()
    gbm = GradientBoostingRegressor(
        n_estimators=320,
        max_depth=6,
        learning_rate=0.09,
        subsample=0.7,
        min_samples_leaf=25,
        random_state=SEED,
    )
    gbm.fit(Xtr, ltr)
    log_pred = gbm.predict(Xte)
    gbm_pred = np.exp(log_pred)
    results["gradientBoosting"] = metrics(yte, gbm_pred)
    results["gradientBoosting"]["trainSeconds"] = round(time.time() - t, 1)
    print("gradient boosting", results["gradientBoosting"])

    dom = Xte[:, feat_names.index("is_domestic")] == 1
    segments = {
        "domestic": metrics(yte[dom], gbm_pred[dom]),
        "international": metrics(yte[~dom], gbm_pred[~dom]),
    }
    log_resid_std = float(np.std(np.log(yte) - log_pred))

    importances = sorted(
        ({"feature": f, "label": FEATURE_LABELS.get(f, f), "importance": round(float(v), 4)} for f, v in zip(feat_names, gbm.feature_importances_)),
        key=lambda d: -d["importance"],
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    exported = export_gbm(gbm, feat_names)
    # Parity samples let the TypeScript unit test prove JS inference == sklearn.
    parity = [{"x": [float(v) for v in Xte[i]], "logPrice": round(float(log_pred[i]), 6)} for i in range(25)]
    model_json = {
        "type": "gradient_boosting_regressor",
        "target": "log(price_inr)",
        "features": feat_names,
        **exported,
        "parity": parity,
    }
    (OUT_DIR / "fare-model.json").write_text(json.dumps(model_json, separators=(",", ":")))

    sample_size = 4000
    metrics_json = {
        "trainedAt": time.strftime("%Y-%m-%d"),
        "sklearnVersion": sklearn.__version__,
        "rows": n,
        "trainRows": int(len(train_idx)),
        "testRows": int(len(test_idx)),
        "split": "random 80/20 hold-out (seed 42)",
        "served": "gradientBoosting",
        "models": results,
        "segments": segments,
        "logResidualStd": round(log_resid_std, 4),
        "params": {"n_estimators": 320, "max_depth": 6, "learning_rate": 0.09, "subsample": 0.7, "min_samples_leaf": 25},
        "featureImportances": importances,
        "testSample": [
            {"actual": int(a), "predicted": int(round(p))}
            for a, p in zip(yte[:sample_size:10], gbm_pred[:sample_size:10])
        ],
    }
    (OUT_DIR / "model-metrics.json").write_text(json.dumps(metrics_json, indent=2) + "\n")

    insights = build_insights(feat_names, X, y, meta)
    (OUT_DIR / "insights.json").write_text(json.dumps(insights, indent=2) + "\n")

    size_kb = (OUT_DIR / "fare-model.json").stat().st_size / 1024
    print(f"Exported {len(exported['trees'])} trees ({size_kb:.0f} KB) + metrics + insights in {time.time() - t0:.0f}s total")


if __name__ == "__main__":
    main()
