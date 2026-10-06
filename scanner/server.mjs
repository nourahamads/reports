#!/usr/bin/env node
/**
 * خادم الفحص المحلي: يستقبل روابط (من ملف Excel في الواجهة)، يفحص كل رابط، ويعيد النتائج سطراً بسطر (NDJSON).
 * يعمل على جهاز الموظف على 127.0.0.1 فقط، ويقدّم الواجهة نفسها على http://localhost:8787
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { createInspector } from "./inspector.mjs";
import { classify, isSaHost, looksSaudi, extractUrlsFromText } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PORT = Number(process.env.PORT || 8787);
const allowLocal = process.env.ALLOW_LOCAL === "1"; // للاختبار فقط
const MAX_URLS = 500;
const allowedOrigins = (process.env.ALLOW_ORIGIN || "https://nourahamads.github.io").split(",").map((s) => s.trim());
const kw = JSON.parse(await fs.readFile(path.join(here, "config/keywords.json"), "utf8"));
const cfg = JSON.parse(await fs.readFile(path.join(here, "config/scan.json"), "utf8"));
const insp = await createInspector(cfg, kw, { allowLocal, shotQuality: 55 });

const isPrivateIp = (ip) => {
  if (net.isIPv6(ip)) return ip === "::1" || /^(fc|fd|fe80)/i.test(ip) || ip.startsWith("::ffff:127.");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
};
async function publicHost(host) {
  if (allowLocal) return true;
  const h = host.replace(/:\d+$/, "");
  if (net.isIP(h)) return !isPrivateIp(h);
  try { return (await dns.lookup(h, { all: true })).every((a) => !isPrivateIp(a.address)); } catch { return false; }
}
function normalizeUrl(s) {
  s = String(s).trim();
  if (!s) return null;
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; }
}

async function check(u) {
  const base = { url: u.href, host: u.host.toLowerCase().replace(/^www\./, ""), checkedAt: new Date().toISOString() };
  if (!(await publicHost(u.hostname))) return { ...base, ok: false, verdict: "تعذر الفحص", error: "الرابط يشير إلى عنوان غير عام" };
  const urls = /^https?:\/\//i.test(u.href) ? [u.href, ...(u.protocol === "https:" ? [u.href.replace(/^https:/, "http:")] : [])] : [u.href];
  const r = await insp.inspect(urls);
  if (!r.ok) return { ...base, ok: false, verdict: "تعذر الفحص", error: r.error };
  let finalHost = base.host;
  try { finalHost = new URL(r.finalUrl).host; } catch {}
  if (!(await publicHost(finalHost))) return { ...base, ok: false, verdict: "تعذر الفحص", error: "أُعيد التوجيه إلى عنوان غير عام" };
  const res = classify(r.info, kw);
  const sig = looksSaudi(/ar-sa/i.test(r.info.lang) ? 'lang="ar-SA"' : "", r.info.text, kw);
  return {
    ...base, ok: true, finalUrl: r.finalUrl, title: r.info.title.slice(0, 160),
    tier: res.tier, verdict: res.verdict, score: res.score, types: res.types, matched: res.matched.map((m) => m.term), stream: res.stream,
    saudi: isSaHost(finalHost) || sig.saudi,
    screenshot: res.tier > 0 ? "data:image/jpeg;base64," + r.shot.toString("base64") : null,
  };
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".css": "text/css" };
const staticOk = (p) => p === "/" || p === "/index.html" || p.startsWith("/vendor/") || p.startsWith("/data/");

function cors(req, res) {
  const o = req.headers.origin;
  if (o && (allowedOrigins.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (url.pathname === "/api/ping") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: true, max: MAX_URLS })); }

  if (url.pathname === "/api/sheet" && req.method === "POST") {
    let body = "";
    for await (const c of req) { body += c; if (body.length > 1e5) { res.writeHead(413); return res.end(); } }
    const json = (code, o) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); };
    let link;
    try { link = String(JSON.parse(body).url || ""); } catch { return json(400, { error: "طلب غير صالح" }); }
    const id = link.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
    const gid = link.match(/[#&?]gid=(\d+)/)?.[1];
    if (!id || !/^https:\/\/docs\.google\.com\//.test(link)) return json(400, { error: "الرابط ليس رابط Google Sheet" });
    const base = process.env.SHEET_BASE || "https://docs.google.com";
    try {
      const r = await fetch(`${base}/spreadsheets/d/${id}/export?format=csv${gid ? "&gid=" + gid : ""}`, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if (!r.ok || /^\s*<(!doctype|html)/i.test(text)) return json(403, { error: "تعذر قراءة الجدول. اجعل المشاركة «أي شخص لديه الرابط: عارض»." });
      const urls = extractUrlsFromText(text);
      return json(200, { urls, count: urls.length });
    } catch (e) { return json(502, { error: "تعذر الاتصال بـ Google Sheets" }); }
  }

  if (url.pathname === "/api/check" && req.method === "POST") {
    let body = "";
    for await (const c of req) { body += c; if (body.length > 2e6) { res.writeHead(413); return res.end(); } }
    let list;
    try { list = JSON.parse(body).urls; } catch { res.writeHead(400); return res.end("bad json"); }
    if (!Array.isArray(list) || !list.length) { res.writeHead(400); return res.end("urls required"); }
    const seen = new Set(), items = [];
    for (const s of list.slice(0, MAX_URLS)) {
      const u = normalizeUrl(s);
      if (!u || seen.has(u.href)) continue;
      seen.add(u.href); items.push(u);
    }
    res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
    const send = (o) => res.write(JSON.stringify(o) + "\n");
    let cancelled = false;
    res.on("close", () => { cancelled = true; });
    send({ type: "start", total: items.length });
    let i = 0;
    await Promise.all(Array.from({ length: cfg.concurrency + 1 }, async () => {
      while (i < items.length && !cancelled) {
        const u = items[i++];
        const r = await check(u).catch((e) => ({ url: u.href, host: u.host, ok: false, verdict: "تعذر الفحص", error: String(e.message).slice(0, 120) }));
        if (!cancelled) send({ type: "result", ...r });
      }
    }));
    send({ type: "done" });
    return res.end();
  }

  if (req.method === "GET" && staticOk(url.pathname)) {
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const f = path.resolve(root, rel);
    if (!f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    try { const d = await fs.readFile(f); res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); return res.end(d); } catch {}
  }
  res.writeHead(404); res.end("not found");
});
server.listen(PORT, "127.0.0.1", () => console.log(`خادم الفحص جاهز: http://localhost:${PORT}`));
process.on("SIGINT", async () => { await insp.close(); process.exit(0); });
