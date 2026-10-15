import { InputError } from "./services.ts";

export function json(data: unknown, init: ResponseInit & { cache?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cache ?? "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function handleError(err: unknown) {
  if (err instanceof InputError) return json({ error: err.message }, { status: 400 });
  console.error(err);
  return json({ error: "server" }, { status: 500 });
}

export async function readJson<T>(req: Request, maxBytes = 64_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new InputError("tooLarge");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InputError("badJson");
  }
}
