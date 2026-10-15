// Proves that the TypeScript tree walker reproduces scikit-learn's
// predictions exactly (parity samples are written by ml/train_model.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictLog, type ExportedModel } from "../../src/lib/ml/model.ts";

const model = JSON.parse(
  readFileSync(new URL("../../src/data/ml/fare-model.json", import.meta.url), "utf8"),
) as ExportedModel;

test("JS inference matches sklearn on the exported parity samples", () => {
  assert.ok(model.parity && model.parity.length >= 10, "parity samples present");
  for (const s of model.parity!) {
    const js = predictLog(model, s.x);
    assert.ok(Math.abs(js - s.logPrice) < 1e-3, `log price ${js} vs sklearn ${s.logPrice}`);
  }
});

test("model has the expected shape", () => {
  assert.equal(model.type, "gradient_boosting_regressor");
  assert.ok(model.trees.length > 50);
  assert.ok(model.features.includes("days_before"));
});
