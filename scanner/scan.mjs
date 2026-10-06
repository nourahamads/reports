#!/usr/bin/env node
/**
 * الفاحص الإلكتروني الآلي — الرصد والتحكم في الفضاء الرقمي
 * 1) يجمع النطاقات (.sa أو المواقع/المتاجر السعودية) من seeds + الروابط المكتشفة + النطاقات البديلة.
 * 2) يفتح كل موقع بمتصفح بلا واجهة ويصنّفه بالكلمات المفتاحية (درجة أولى: بث مباشر / IPTV => مخالف).
 * 3) يحفظ لقطة شاشة للمخالف ويكتب النتائج في data/findings.json.
 */
import { chromium } from "playwright";
import { promises as dns } from "node:dns";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, registrable, isSaHost, looksSaudi, fetchable, safeName } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const root = path.resolve(here, "..");
const dataDir = path.resolve(opt("data-dir", path.join(root, "data")));
const shotDir = path.join(dataDir, "screenshots");
const allowLocal = flag("allow-local");
const kw = JSON.parse(await fs.readFile(path.join(here, "config/keywords.json"), "utf8"));
const cfg = JSON.parse(await fs.readFile(path.join(here, "config/scan.json"), "utf8"));
if (opt("max")) cfg.maxPerRun = Number(opt("max"));
const now = new Date();
const iso = now.toISOString();
const DAY = 864e5;

const readJson = async (f, d) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return d; } };
const state = await readJson(path.join(dataDir, "state.json"), { domains: {} });
const findings = new Map((await readJson(path.join(dataDir, "findings.json"), { findings: [] })).findings.map((f) => [f.id, f]));
await fs.mkdir(shotDir, { recursive: true });

/* ---------- بناء قائمة الفحص ---------- */
const hostOf = (s) => { try { return new URL(/^https?:/i.test(s) ? s : "https://" + s).host.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
const seeds = (await fs.readFile(path.join(here, "config/seeds.txt"), "utf8").catch(() => ""))
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map(hostOf).filter(Boolean);
const only = opt("only") ? opt("only").split(",").map(hostOf).filter(Boolean) : null;

for (const h of seeds) state.domains[h] ??= { depth: 0, status: "new", seed: true };

const due = (h, e) => {
  if (e.status === "new") return 0;
  const age = (now - new Date(e.lastChecked || 0)) / DAY;
  const wait = e.status === "error" ? 1 : e.status === "out_of_scope" ? 30 : cfg.recheckAfterDays;
  return age >= wait ? age : -1;
};
let queue = only
  ? only.map((h) => (state.domains[h] ??= { depth: 0, status: "new", seed: true }) && h)
  : Object.entries(state.domains)
      .filter(([h, e]) => due(h, e) >= 0 && fetchable(h, allowLocal))
      .sort((a, b) => due(b[0], b[1]) - due(a[0], a[1]) || (a[1].depth ?? 9) - (b[1].depth ?? 9))
      .map(([h]) => h);
queue = queue.slice(0, cfg.maxPerRun);
console.log(`المستهدف في هذه الدورة: ${queue.length} نطاق`);

/* ---------- الفحص ---------- */
const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: cfg.userAgent, viewport: { width: 1366, height: 768 }, locale: "ar-SA", acceptDownloads: false, ignoreHTTPSErrors: true });
context.on("page", async (p) => { if (await p.opener().catch(() => null)) p.close().catch(() => {}); }); // منع النوافذ المنبثقة

async function inspect(host) {
  const page = await context.newPage();
  let streamRequests = 0;
  await page.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    if (new RegExp(kw.streamRequestPattern, "i").test(url)) { streamRequests++; return route.abort(); }
    if (req.resourceType() === "media") return route.abort(); // لا نحمّل الوسائط
    return route.continue();
  });
  try {
    let resp, err;
    for (const proto of allowLocal && host.includes(":") ? ["http"] : ["https", "http"]) {
      try { resp = await page.goto(`${proto}://${host}/`, { waitUntil: "domcontentloaded", timeout: cfg.pageTimeoutMs }); break; } catch (e) { err = e; }
    }
    if (!resp) throw err || new Error("تعذر الاتصال");
    await page.waitForTimeout(cfg.settleMs);
    const info = await page.evaluate(() => {
      const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim()).join(" ");
      const m = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || "";
      return {
        title: document.title,
        headings: txt("h1,h2"),
        meta: [m("description"), m("keywords"), m("og:title"), m("og:description")].join(" "),
        text: (document.body?.innerText || "").slice(0, 30000),
        lang: document.documentElement.getAttribute("lang") || "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        hasPlayer: !!document.querySelector("video,iframe[src*='player'],iframe[src*='embed'],script[src*='hls'],script[src*='jwplayer'],script[src*='video']"),
        links: [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /^https?:/i.test(h)),
      };
    });
    const finalUrl = page.url();
    const buf = Buffer.from(await page.screenshot({ type: "jpeg", quality: 70 }));
    return { ok: true, info: { ...info, streamRequests }, finalUrl, shot: buf, status: resp.status() };
  } catch (e) {
    return { ok: false, error: String(e.message || e).split("\n")[0].slice(0, 160) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function probeAlternates(host) {
  const { label, suffix } = registrable(host);
  const out = [];
  for (const s of cfg.alternateSuffixes) {
    const cand = `${label}.${s}`;
    if (cand === host || s === suffix) continue;
    try { const a = await Promise.race([dns.resolve4(cand), new Promise((_, r) => setTimeout(() => r(new Error("t")), 4000))]); if (a?.length) out.push(cand); } catch {}
  }
  return out;
}

function enqueueDiscovered(host, fromHost, depth, extra = {}) {
  if (!host || host === fromHost || !fetchable(host, allowLocal)) return false;
  if (state.domains[host]) return false;
  state.domains[host] = { depth, status: "new", via: fromHost, ...extra };
  return true;
}

async function handle(host) {
  const entry = (state.domains[host] ??= { depth: 0, status: "new" });
  entry.lastChecked = iso;
  const r = await inspect(host);
  if (!r.ok) { entry.status = "error"; entry.error = r.error; console.log(`✗ ${host}: ${r.error}`); return; }

  const { info } = r;
  const finalHost = hostOf(r.finalUrl) || host;
  const sa = isSaHost(finalHost) || isSaHost(host);
  const sig = looksSaudi(info.lang && /ar-sa/i.test(info.lang) ? `lang="ar-SA"` : "", info.text, kw);
  const inherited = !!entry.inheritScope;
  const inScope = sa || sig.saudi || inherited;
  const aliases = new Set();
  if (finalHost !== host) aliases.add(finalHost);
  const canon = hostOf(info.canonical || "");
  if (canon && canon !== host) aliases.add(canon);

  if (!inScope) { entry.status = "out_of_scope"; findings.delete(host); console.log(`– ${host}: خارج النطاق`); return; }

  const result = classify(info, kw);
  const scopeReason = sa ? "نطاق .sa" : inherited ? `نطاق بديل لـ ${entry.alternateOf}` : `مؤشرات سعودية: ${sig.found.slice(0, 3).join("، ")}`;
  console.log(`${result.tier ? "⚠" : "✓"} ${host}: ${result.verdict} (${result.score}) [${scopeReason}]`);

  /* اكتشاف: روابط خارجية جديدة + نطاقات بديلة للمخالفين */
  const depth = (entry.depth ?? 0) + 1;
  if (depth <= cfg.maxDiscoveryDepth) {
    const seen = new Set();
    for (const l of info.links) {
      const h = hostOf(l);
      if (!h || h === host || h === finalHost || seen.has(h)) continue;
      if (seen.size >= cfg.maxLinksPerPage) break;
      if (isSaHost(h) || result.tier > 0) { seen.add(h); enqueueDiscovered(h, host, depth); }
    }
  }
  if (result.tier === 1 && !flag("no-probe")) {
    for (const alt of await probeAlternates(finalHost)) {
      aliases.add(alt);
      enqueueDiscovered(alt, host, depth, { inheritScope: true, alternateOf: host });
    }
  }

  if (result.tier === 0) { entry.status = "clean"; findings.delete(host); return; }

  entry.status = "finding";
  const shotRel = `data/screenshots/${safeName(host)}.jpg`;
  await fs.writeFile(path.join(shotDir, `${safeName(host)}.jpg`), r.shot);
  const prev = findings.get(host);
  findings.set(host, {
    id: host, host, url: r.finalUrl, title: info.title.slice(0, 160),
    tier: result.tier, verdict: result.verdict, score: result.score, types: result.types, matched: result.matched,
    stream: result.stream, scope: scopeReason, aliases: [...aliases], alternateOf: entry.alternateOf || null,
    screenshot: shotRel, screenshotAt: iso, firstSeen: prev?.firstSeen || iso, lastSeen: iso,
  });
}

let i = 0;
await Promise.all(Array.from({ length: cfg.concurrency }, async () => {
  while (i < queue.length) await handle(queue[i++]).catch((e) => console.log("خطأ غير متوقع:", e.message));
}));
await browser.close();

/* ---------- حفظ ---------- */
const list = [...findings.values()].sort((a, b) => a.tier - b.tier || b.score - a.score);
await fs.writeFile(path.join(dataDir, "findings.json"), JSON.stringify({ updated: iso, findings: list }, null, 1));
await fs.writeFile(path.join(dataDir, "state.json"), JSON.stringify(state, null, 1));
console.log(`تم. المخالفات: ${list.filter((f) => f.tier === 1).length} | للمراجعة: ${list.filter((f) => f.tier === 2).length} | إجمالي النطاقات المعروفة: ${Object.keys(state.domains).length}`);
