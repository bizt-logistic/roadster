#!/usr/bin/env node
// Promo recorder: renders the scroll experience frame by frame on a virtual
// clock, so every frame is complete even on software GL. The scroll follows a
// hand-like rhythm (swipe, glide, settle) and slows down on the key scenes.
//
//   node scripts/film.mjs --url=http://localhost:3100/ --out=video/frames
//   node scripts/film.mjs --preview   (every 10th frame only, for a quick check)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const body = a.replace(/^--/, "");
  const i = body.indexOf("=");
  return i < 0 ? [body, true] : [body.slice(0, i), body.slice(i + 1)];
}));
const URL_ = args.url ?? "http://localhost:3100/";
const W = Number(args.w ?? 1440), H = Number(args.h ?? 900);
const FPS = Number(args.fps ?? 30);
const OUT = path.resolve(args.out ?? "video/frames");
const EVERY = args.preview ? 10 : 1;
const PORT = 9300 + Math.floor(Math.random() * 500);

// [beatFrom, beatTo, seconds]. A "hold" has from === to.
const PLAN = [
  [0, 0, 5.0], // page loads, the car draws itself
  [0, 20, 4.6], // sketch → wireframe → photoreal
  [20, 37, 3.6], // performance band
  [37, 52, 3.6], // x-ray anatomy
  [52, 72, 3.4], // camera moves
  [72, 96, 4.0], // showcase + split
  [96, 104, 1.6], // typography
  [104, 138, 5.8], // finale + stunts
  [138, 138, 1.6],
];
const TOTAL = PLAN.reduce((s, p) => s + p[2], 0);

// Two-finger swipe rhythm: a quick push, then momentum that decays.
const PERIOD = 1.15;
function pulse(t) {
  const f = (t % PERIOD) / PERIOD;
  const push = 0.32;
  const v = f < push ? Math.sin((Math.PI / 2) * (f / push)) ** 2 : Math.exp(-(f - push) * 4.2);
  return 0.22 + 0.78 * v;
}
const DT = 1 / 240;
function beatAt(t) {
  let t0 = 0;
  for (const [i, [a, b, d]] of PLAN.entries()) {
    if (t <= t0 + d || i === PLAN.length - 1) {
      if (a === b) return a;
      const local = Math.min(t, t0 + d);
      let done = 0, all = 0;
      for (let s = t0; s < t0 + d; s += DT) {
        const w = pulse(s);
        all += w;
        if (s < local) done += w;
      }
      return a + (b - a) * (done / all);
    }
    t0 += d;
  }
  return PLAN.at(-1)[1];
}

const SHIM = `(() => {
  let now = 0, rid = 0;
  const q = new Map();
  const base = Date.now();
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { q.set(++rid, cb); return rid; };
  window.cancelAnimationFrame = (id) => q.delete(id);
  window.__film = {
    step(ms) {
      now += ms;
      const cbs = [...q.values()];
      q.clear();
      for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
    },
  };
})();`;

const candidates = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const exe = candidates.find((p) => fs.existsSync(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "roadster-film-"));
const browser = spawn(exe, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  "--hide-scrollbars",
  ...(args.gpu ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]),
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(pathname, method = "GET") {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${pathname}`, { method });
      if (r.ok) return r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error("DevTools endpoint not reachable");
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const target = await json(`/json/new?about:blank`, "PUT");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: SHIM });
  await send("Page.navigate", { url: URL_ });

  const gl = await (async () => {
    for (let i = 0; i < 100; i++) {
      const r = await evaluate(`(() => { const c = document.querySelector('canvas'); const g = c && (c.getContext('webgl2') || c.getContext('webgl')); if (!g) return null; const x = g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'webgl'; })()`).catch(() => null);
      if (r) return r;
      await evaluate(`window.__film && window.__film.step(33)`).catch(() => {});
      await sleep(100);
    }
    return "none";
  })();
  console.log(`renderer: ${gl}`);

  // Load in virtual time until the intro starts (the loader begins to lift).
  const t0 = Date.now();
  for (;;) {
    const ready = await evaluate(`(() => { return !!(window.__roadster && window.__roadster.introStarted); })()`).catch(() => false);
    if (ready) break;
    if (Date.now() - t0 > 240000) throw new Error("Timed out loading");
    await evaluate(`window.__film && window.__film.step(16)`).catch(() => {});
    await sleep(40);
  }
  console.log(`ready after ${((Date.now() - t0) / 1000).toFixed(1)}s; recording ${TOTAL.toFixed(1)}s @ ${FPS}fps`);

  const frames = Math.round(TOTAL * FPS);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    await evaluate(`window.__roadster.goto(${beatAt(t).toFixed(4)}); window.__film.step(${(1000 / FPS).toFixed(4)})`);
    if (f % EVERY !== 0) continue;
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    fs.writeFileSync(path.join(OUT, `f${String(f).padStart(4, "0")}.jpg`), Buffer.from(shot.data, "base64"));
    if (f % 60 === 0) {
      const per = (Date.now() - started) / (f + 1);
      console.log(`frame ${f}/${frames} · beat ${beatAt(t).toFixed(1)} · ~${Math.round(((frames - f) * per) / 1000)}s left`);
    }
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ fps: FPS, frames, w: W, h: H, every: EVERY }));
  if (logs.length) [...new Set(logs)].forEach((l) => console.log("  " + l.slice(0, 300)));
  console.log("done");
  ws.close();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => {
    browser.kill();
    setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500);
  });
