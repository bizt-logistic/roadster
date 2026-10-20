#!/usr/bin/env node
// Visual QA: drives a headless Chromium (Edge or Chrome) over the DevTools
// protocol, waits for the experience to load, jumps to timeline beats and
// saves full-resolution screenshots. Also reports console warnings/errors.
//
//   node scripts/capture.mjs --url=http://localhost:3000 --w=1440 --h=900 --out=qa/desktop
//   node scripts/capture.mjs --mobile --w=390 --h=844 --out=qa/mobile
//   node scripts/capture.mjs --at=0,12,30,45,60,76,84,98

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const body = a.replace(/^--/, "");
  const i = body.indexOf("=");
  return i < 0 ? [body, true] : [body.slice(0, i), body.slice(i + 1)];
}));
const URL_ = args.url ?? "http://localhost:3000";
const W = Number(args.w ?? 1440), H = Number(args.h ?? 900);
const MOBILE = !!args.mobile;
const OUT = path.resolve(args.out ?? "qa");
const BEATS = (args.at ?? "0,4,11,16,24,30,34,40,44,48,54,62,66,74,78,84,88,92,99").split(",").map(Number);
const SETTLE = Number(args.settle ?? 2600);
const PORT = 9300 + Math.floor(Math.random() * 500);

const candidates = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const exe = candidates.find((p) => fs.existsSync(p));
if (!exe) throw new Error("No Chromium-based browser found; set BROWSER=/path/to/chrome");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "roadster-qa-"));
const browser = spawn(exe, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  "--hide-scrollbars",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
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
    } else if (msg.method === "Runtime.consoleAPICalled" && ["warning", "error"].includes(msg.params.type)) {
      logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
  if (MOBILE) {
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Emulation.setUserAgentOverride", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
  }
  if (typeof args.cookie === "string") {
    // --cookie=name:value (e.g. an admin session for dashboard screenshots)
    const [name, ...rest] = args.cookie.split(":");
    await send("Network.enable");
    await send("Network.setCookie", { name, value: rest.join(":"), url: URL_ });
  }
  await send("Page.navigate", { url: URL_ });

  // --plain: ordinary page (shop, receipt) — wait, then one full-page shot.
  if (args.plain) {
    await sleep(Number(args.wait ?? 9000));
    if (args.click) {
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(String(args.click))}); el && el.click(); return !!el; })()`);
      await sleep(1500);
    }
    const m = await send("Page.getLayoutMetrics");
    const hgt = Math.min(6000, Math.ceil(m.cssContentSize?.height ?? m.contentSize.height));
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: hgt, scale: 1 } });
    const file = path.join(OUT, `${String(args.name ?? "page")}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
    if (logs.length) [...new Set(logs)].forEach((l) => console.log("  " + l.slice(0, 300)));
    ws.close();
    return;
  }

  const t0 = Date.now();
  for (;;) {
    const ready = await evaluate(`(() => { const l = document.querySelector('[data-s=loader]'); return !!l && getComputedStyle(l).visibility === 'hidden'; })()`).catch(() => false);
    if (ready) break;
    if (Date.now() - t0 > 180000) throw new Error("Timed out waiting for the experience to become ready");
    await sleep(500);
  }
  console.log(`ready after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await sleep(Number(args.intro ?? 7000));

  const fps = await evaluate(`new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(Math.round(n / ((performance.now() - s) / 1000))); }; requestAnimationFrame(f); })`);
  console.log(`idle rAF rate: ~${fps} fps (headless/software GL — not representative of a real GPU)`);

  for (const beat of BEATS) {
    await evaluate(`window.__roadster && window.__roadster.goto(${beat})`);
    await sleep(SETTLE);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT, `beat-${String(beat).padStart(3, "0")}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
  }
  if (logs.length) {
    console.log("\nConsole warnings/errors:");
    [...new Set(logs)].forEach((l) => console.log("  " + l.slice(0, 300)));
  } else console.log("\nNo console warnings or errors.");
  ws.close();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => {
    browser.kill();
    setTimeout(() => {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* browser may still hold files */ }
    }, 1500);
  });
