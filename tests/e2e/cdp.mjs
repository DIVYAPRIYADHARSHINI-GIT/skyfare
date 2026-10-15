// Minimal Chrome DevTools Protocol driver (no npm dependencies).
// Launches the locally installed Chrome headless with a throwaway profile and
// exposes a tiny page API used by tests/e2e/smoke.mjs.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "skyfare-chrome-"));
  const chromePath = CHROME_PATHS[0];
  const proc = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--lang=en-US",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl;
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!wsUrl) throw new Error("Chrome did not start");
  const browser = await connect(wsUrl);
  return {
    browser,
    async newPage() {
      const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const t = list.find((x) => x.id === targetId);
      const conn = await connect(t.webSocketDebuggerUrl);
      return makePage(conn, targetId, browser);
    },
    async close() {
      try {
        await browser.send("Browser.close");
      } catch {}
      proc.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      (listeners.get(msg.method) ?? []).forEach((f) => f(msg.params));
    }
  };
  return {
    send(method, params = {}, timeoutMs = 30000) {
      const i = ++id;
      ws.send(JSON.stringify({ id: i, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(i);
          reject(new Error(`CDP timeout: ${method}`));
        }, timeoutMs);
        pending.set(i, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    once(method) {
      return new Promise((resolve) => {
        const fn = (p) => {
          const arr = listeners.get(method) ?? [];
          listeners.set(method, arr.filter((f) => f !== fn));
          resolve(p);
        };
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(fn);
      });
    },
    close() {
      ws.close();
    },
  };
}

function makePage(c, targetId, browser) {
  const errors = [];
  const consoleMsgs = [];
  const page = {
    errors,
    consoleMsgs,
    async init() {
      await c.send("Page.enable");
      await c.send("Runtime.enable");
      await c.send("Network.enable");
      c.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
      c.on("Runtime.consoleAPICalled", (p) => {
        const text = p.args.map((a) => a.value ?? a.description ?? "").join(" ");
        consoleMsgs.push(`${p.type}: ${text}`);
        if (p.type === "error") errors.push(`console.error: ${text}`);
      });
      c.on("Network.responseReceived", (p) => {
        if (p.response.status >= 500) errors.push(`HTTP ${p.response.status} ${p.response.url}`);
      });
      // Auto-accept alert/confirm dialogs so they can never block the page.
      c.on("Page.javascriptDialogOpening", () => {
        c.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
      });
      return page;
    },
    async viewport(width, height, mobile = false) {
      await c.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await c.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    },
    async addInitScript(source) {
      await c.send("Page.addScriptToEvaluateOnNewDocument", { source });
    },
    async goto(url, { wait = 600 } = {}) {
      const loaded = c.once("Page.loadEventFired");
      await c.send("Page.navigate", { url });
      await Promise.race([loaded, sleep(15000)]);
      // Wait until the new document is the one we asked for and hydrated.
      const target = new URL(url);
      await page.waitFor(`location.pathname === ${JSON.stringify(target.pathname)} && document.readyState === 'complete' && !!document.querySelector('header')`, 15000).catch(() => {});
      await page.waitIdle();
      await sleep(wait);
    },
    async waitIdle(timeout = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const busy = await page.eval(`document.readyState !== "complete" || !!document.querySelector('[role=status] .animate-fly')`);
        if (!busy) return;
        await sleep(150);
      }
    },
    async eval(expr) {
      const r = await c.send("Runtime.evaluate", { expression: `(async () => (${expr}))()`, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${expr}`);
      return r.result.value;
    },
    async waitFor(expr, timeout = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          // Coerce to a serialisable value (DOM nodes can't be returned by value).
          const v = await page.eval(`(() => { const r = (${expr}); return r instanceof Node ? true : r; })()`);
          if (v) return v;
        } catch {}
        await sleep(120);
      }
      throw new Error(`timeout waiting for: ${expr}`);
    },
    async click(selector) {
      const ok = await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`);
      if (!ok) throw new Error(`click: not found ${selector}`);
      await sleep(250);
    },
    /** Set a React-controlled input/select value. */
    async fill(selector, value) {
      const ok = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      if (!ok) throw new Error(`fill: not found ${selector}`);
      await sleep(150);
    },
    async text(selector) {
      return page.eval(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? null`);
    },
    async count(selector) {
      return page.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    },
    async screenshot(path, { fullPage = false } = {}) {
      let clip;
      if (fullPage) {
        const m = await c.send("Page.getLayoutMetrics");
        const h = Math.min(Math.ceil(m.cssContentSize.height), 6000);
        const w = Math.ceil(m.cssLayoutViewport.clientWidth);
        clip = { x: 0, y: 0, width: w, height: h, scale: 1 };
      }
      const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    async setDownloadDir(dir) {
      await browser.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir, eventsEnabled: true });
    },
    async close() {
      try {
        await browser.send("Target.closeTarget", { targetId });
      } catch {}
      c.close();
    },
  };
  return page.init();
}

export { sleep };
