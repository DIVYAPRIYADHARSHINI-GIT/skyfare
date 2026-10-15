"use client";
// About / Insights: what SkyFare is, how the ML model works, its accuracy
// (MAE, R^2 ...) on the held-out test set, feature importance and photo credits.
import { Brain, Database, Info, Lock, Camera } from "lucide-react";
import credits from "@/data/image-credits.json";
import { useI18n } from "@/i18n";
import { AIRLINES } from "@/lib/sim/airlines";
import { useApi } from "@/lib/client";
import type { ModelResponse } from "@/lib/types";
import { AirlineLogo } from "@/components/AirlineLogo";
import { ImportanceChart, ScatterFit } from "@/components/charts";
import { Card, Loading, PageHeader } from "@/components/ui";

export function AboutView() {
  const { t, formatNumber, formatPrice, formatDate, city } = useI18n();
  const { data, loading } = useApi<ModelResponse>("/api/model");
  const m = data?.metrics;
  const gbm = m?.models.gradientBoosting;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("about.title")} subtitle={t("about.body")} icon={<Info className="h-6 w-6" />} />

      <Card className="mb-5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <Brain className="h-5 w-5 text-brand-600" aria-hidden="true" />
          {t("about.model.title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("about.model.body")}</p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          {["ml/data/fare_history.csv", "ml/train_model.py", "src/data/ml/fare-model.json", "/api/predict"].map((s, i) => (
            <li key={s} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span className="text-xs font-bold text-brand-600">{i + 1}</span>
              <code className="mt-1 block break-all text-xs text-slate-700 dark:text-slate-300">{s}</code>
            </li>
          ))}
        </ol>
      </Card>

      {loading || !m || !gbm ? (
        <Loading />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">{t("about.metrics")}</h2>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="metrics">
            {[
              { k: t("about.mae"), v: formatPrice(gbm.mae), hint: t("about.mae.hint") },
              { k: t("about.r2"), v: formatNumber(gbm.r2, 3), hint: t("about.r2.hint") },
              { k: t("about.mape"), v: `${formatNumber(gbm.mape, 1)}%`, hint: t("about.mape.hint") },
              { k: t("about.rmse"), v: formatPrice(gbm.rmse), hint: m.split },
            ].map((x) => (
              <Card key={x.k} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{x.k}</p>
                <p className="tabular mt-1 text-2xl font-extrabold text-brand-700 dark:text-brand-300" data-testid={`metric-${x.k}`}>
                  {x.v}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{x.hint}</p>
              </Card>
            ))}
          </div>
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
            {t("about.segments", { dom: formatPrice(m.segments.domestic.mae), intl: formatPrice(m.segments.international.mae) })}
          </p>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("about.compare")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-start text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 text-start font-semibold" />
                      <th className="py-2 text-end font-semibold">MAE</th>
                      <th className="py-2 text-end font-semibold">MAPE</th>
                      <th className="py-2 text-end font-semibold">R²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(
                      [
                        [t("about.model.baseline"), m.models.baseline],
                        [t("about.model.rf"), m.models.randomForest],
                        [t("about.model.gbm"), m.models.gradientBoosting],
                      ] as const
                    ).map(([name, x], i) => (
                      <tr key={name} className={i === 2 ? "font-semibold text-brand-700 dark:text-brand-300" : ""}>
                        <td className="py-2">{name}</td>
                        <td className="tabular py-2 text-end">{formatPrice(x.mae)}</td>
                        <td className="tabular py-2 text-end">{formatNumber(x.mape, 1)}%</td>
                        <td className="tabular py-2 text-end">{formatNumber(x.r2, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mb-2 mt-5 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Database className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("about.dataset")}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t("about.dataset.rows", {
                  rows: formatNumber(data.dataset.rows),
                  routes: formatNumber(data.dataset.routes),
                  start: formatDate(data.dataset.historyStart),
                  end: formatDate(data.dataset.historyEnd),
                })}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                scikit-learn {m.sklearnVersion} · {m.trainRows.toLocaleString()} train / {m.testRows.toLocaleString()} test · {m.params.n_estimators} trees, depth {m.params.max_depth}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("about.importance")}</h3>
              <ImportanceChart data={m.featureImportances.slice(0, 10)} />
            </Card>
          </div>
          <Card className="mb-5 p-4">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("about.scatter")}</h3>
            <ScatterFit data={m.testSample} />
          </Card>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Lock className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            {t("about.privacy.title")}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("about.privacy.body")}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {AIRLINES.map((a) => (
              <li key={a.code} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <AirlineLogo code={a.code} size={24} />
                {a.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{t("about.disclaimer")}</p>
        </Card>
        <Card className="p-5" as="section">
          <h2 id="credits" className="mb-2 flex scroll-mt-24 items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Camera className="h-5 w-5 text-brand-600" aria-hidden="true" />
            {t("about.credits")}
          </h2>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t("about.credits.body")}</p>
          <ul className="max-h-72 space-y-1 overflow-auto text-xs text-slate-600 dark:text-slate-300">
            {Object.entries(credits).map(([code, c]) => (
              <li key={code}>
                <span className="font-semibold">{code === "hero" ? "Hero" : city(code)}</span>:{" "}
                <a href={c.page} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-300">
                  {c.title}
                </a>{" "}
                · {c.creator} · {c.license} ({c.source})
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
