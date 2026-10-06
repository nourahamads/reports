#!/usr/bin/env node
/** جالب أخبار «مرصد الإنفاذ»: يقرأ خلاصات RSS/Atom ويكتب data/news.json (عنوان + رابط + مصدر). */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { normalize } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const dataDir = path.resolve(opt("data-dir", path.join(here, "../data")));
const cfg = JSON.parse(await fs.readFile(path.resolve(opt("sources", path.join(here, "config/news-sources.json"))), "utf8"));

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x) => String(typeof x === "object" && x !== null ? x["#text"] ?? "" : x ?? "").trim();
const stripHtml = (s) => String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function feedUrl(f) {
  if (f.url) return f.url;
  const p = new URLSearchParams({ q: f.query, hl: f.hl || "ar", gl: f.gl || "SA", ceid: f.ceid || "SA:ar" });
  return `https://news.google.com/rss/search?${p}`;
}

/** يحلل RSS 2.0 أو Atom إلى عناصر موحدة */
export function parseFeed(body) {
  const d = xml.parse(body);
  const out = [];
  for (const it of arr(d?.rss?.channel?.item)) {
    const srcNode = it.source;
    let title = stripHtml(txt(it.title)), source = txt(srcNode), sourceUrl = srcNode?.["@_url"] || "";
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim(); // أخبار Google تضيف اسم الناشر للعنوان
    const desc = stripHtml(txt(it.description));
    out.push({ title, url: txt(it.link), source, sourceUrl, date: txt(it.pubDate), summary: desc && desc !== title && !desc.startsWith(title) ? desc.slice(0, 280) : "" });
  }
  for (const e of arr(d?.feed?.entry)) {
    const link = arr(e.link).find((l) => !l["@_rel"] || l["@_rel"] === "alternate") || arr(e.link)[0];
    out.push({ title: stripHtml(txt(e.title)), url: link?.["@_href"] || "", source: txt(d.feed.title), sourceUrl: "", date: txt(e.updated || e.published), summary: stripHtml(txt(e.summary || e.content)).slice(0, 280) });
  }
  return out;
}

const hostOf = (u) => { try { return new URL(u).origin; } catch { return ""; } };
async function fetchText(url) {
  let err;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; EnforcementObservatory/1.0)", accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20000), redirect: "follow" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) { err = e; }
  }
  throw err;
}

/** هل الخبر ذو صلة؟ (الموضوع + النطاق المحلي) */
export function makeFilters(cfg) {
  const re = (x) => new RegExp(normalize(x), "i");
  const topics = Object.fromEntries(Object.entries(cfg.topics).map(([k, v]) => [k, { inc: re(v.match), exc: v.exclude ? re(v.exclude) : null }]));
  const saudi = re(cfg.localMarkers), weak = re(cfg.localWeak || "$^"), pub = re(cfg.localSources || "$^"), other = cfg.localExclude ? re(cfg.localExclude) : null;
  return (item, scope, topic) => {
    const hay = normalize(`${item.title} ${item.summary}`), t = topics[topic];
    if (!t.inc.test(hay) || (t.exc && t.exc.test(hay))) return false;
    if (scope !== "محلي") return true;
    if (saudi.test(hay)) return true;                                   // يذكر السعودية صراحة
    if (other && other.test(normalize(item.title))) return false;       // خبر عن دولة أخرى
    if (weak.test(hay)) return true;                                    // «المملكة» دون بلد آخر في العنوان
    return pub.test(normalize(`${item.source} ${item.sourceUrl}`));     // ناشر سعودي
  };
}

export async function build(cfg, fetcher = fetchText, now = Date.now()) {
  const maxAge = (cfg.maxAgeDays || 60) * 864e5;
  const relevant = makeFilters(cfg);
  const items = new Map(), feeds = [];
  for (const f of cfg.feeds) {
    const topic = cfg.topics[f.topic];
    try {
      const raw = parseFeed(await fetcher(feedUrl(f)));
      let kept = 0;
      for (const r of raw) {
        const t = Date.parse(r.date);
        if (!r.title || !/^https?:\/\//.test(r.url) || !Number.isFinite(t) || now - t > maxAge || t > now + 864e5) continue;
        if (!relevant(r, f.scope, f.topic)) continue;
        const key = normalize(r.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        if (items.has(key)) continue;
        items.set(key, { id: crypto.createHash("sha1").update(r.url).digest("hex").slice(0, 12), title: r.title, url: r.url, source: r.source || "", sourceUrl: r.sourceUrl || hostOf(r.url), scope: f.scope, topic: f.topic, topicName: topic.name, date: new Date(t).toISOString(), summary: r.summary });
        kept++;
      }
      feeds.push({ id: f.id, ok: true, fetched: raw.length, kept });
    } catch (e) { feeds.push({ id: f.id, ok: false, error: String(e.message || e).slice(0, 120) }); }
  }
  const groups = new Map(), out = [];
  for (const it of [...items.values()].sort((a, b) => b.date.localeCompare(a.date))) {
    const g = `${it.topic}|${it.scope}`;
    const n = groups.get(g) || 0;
    if (n >= (cfg.maxPerGroup || 25)) continue;
    groups.set(g, n + 1); out.push(it);
  }
  return { updated: new Date(now).toISOString(), topics: Object.fromEntries(Object.entries(cfg.topics).map(([k, v]) => [k, v.name])), feeds, items: out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prev = await fs.readFile(path.join(dataDir, "news.json"), "utf8").then(JSON.parse).catch(() => null);
  const res = await build(cfg);
  const okFeeds = res.feeds.filter((f) => f.ok).length;
  console.log(`الخلاصات الناجحة: ${okFeeds}/${res.feeds.length} | الأخبار: ${res.items.length}`);
  for (const f of res.feeds) console.log(` - ${f.id}: ${f.ok ? `${f.kept}/${f.fetched}` : "فشل: " + f.error}`);
  if (!okFeeds && prev) { console.log("فشلت كل الخلاصات؛ يُبقى الملف السابق."); process.exit(0); }
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, "news.json"), JSON.stringify(res, null, 1));
}
