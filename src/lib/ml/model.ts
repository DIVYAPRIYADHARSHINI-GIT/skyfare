// Pure-TypeScript inference for the scikit-learn GradientBoostingRegressor
// exported by ml/train_model.py. Each tree is stored as flat arrays
// (feature, threshold, left, right, value); prediction = init +
// learning_rate * sum(tree leaf values), in log(price) space.
// Runs in a Vercel serverless function - no Python needed at runtime.

export interface ExportedTree {
  f: number[];
  t: number[];
  l: number[];
  r: number[];
  v: number[];
}

export interface ExportedModel {
  type: string;
  target: string;
  features: string[];
  init: number;
  learningRate: number;
  trees: ExportedTree[];
  parity?: Array<{ x: number[]; logPrice: number }>;
}

function walk(tree: ExportedTree, x: number[]): number {
  let node = 0;
  while (tree.l[node] !== -1) {
    // scikit-learn sends samples with x <= threshold to the left child.
    node = x[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node];
  }
  return tree.v[node];
}

export function predictLog(model: ExportedModel, x: number[]): number {
  let s = 0;
  for (const tree of model.trees) s += walk(tree, x);
  return model.init + model.learningRate * s;
}

export function predictPrice(model: ExportedModel, x: number[]): number {
  return Math.exp(predictLog(model, x));
}
