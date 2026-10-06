import { parse } from "tldts";

/* تطبيع النص العربي/الإنجليزي للمطابقة: حذف التشكيل والتطويل، توحيد الألف والياء والتاء المربوطة */
export function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

/**
 * تصنيف صفحة وفق الكلمات المفتاحية.
 * page: { title, headings, meta, text, streamRequests: number, hasPlayer: bool }
 * الدرجة الأولى (tier 1): بث مباشر / IPTV => "مخالف". الدرجة الثانية: أفلام ومسلسلات => "للمراجعة".
 */
export function classify(page, cfg) {
  const head = normalize([page.title, page.headings, page.meta].join(" \n "));
  const body = normalize(page.text || "");
  const scores = { 1: 0, 2: 0 };
  const matched = [];
  const types = new Set();
  const groupScore = {};

  for (const [gName, g] of Object.entries(cfg.groups)) {
    let gs = 0;
    for (const [term, w] of g.terms) {
      const t = normalize(term);
      const inHead = countOccurrences(head, t) > 0;
      const inBody = Math.min(countOccurrences(body, t), 3);
      if (!inHead && !inBody) continue;
      const s = w * (inBody + (inHead ? 3 : 0));
      gs += s;
      matched.push({ term, group: gName, score: s, inTitle: inHead });
    }
    groupScore[gName] = gs;
    scores[g.tier] += gs;
    if (gs >= Math.min(cfg.thresholds.tier2, 4)) types.add(g.type);
  }

  const stream = (page.streamRequests || 0) > 0 || !!page.hasPlayer;
  const t = cfg.thresholds;
  const strongStream = (page.streamRequests || 0) > 0;
  let tier = 0;
  if (scores[1] >= t.tier1 || (scores[1] >= t.tier1WithStream && strongStream)) tier = 1;
  else if (scores[2] >= t.tier2 || scores[1] >= (t.tier2FromTier1 ?? 6)) tier = 2;

  const eco = (cfg.ecommerceTerms || []).some((e) => body.includes(normalize(e)));
  if (tier === 1 && eco && groupScore.iptv > 0) types.add("متجر / اشتراكات");

  const verdict = tier === 1 ? "مخالف" : tier === 2 ? "للمراجعة" : "غير مخالف";
  matched.sort((a, b) => b.score - a.score);
  return { tier, verdict, score: scores[1] + scores[2], scoreTier1: scores[1], scoreTier2: scores[2], stream, types: [...types], matched: matched.slice(0, 8) };
}

/* ===== النطاق ===== */
export function registrable(host) {
  const p = parse(host);
  return { domain: p.domain || host, label: p.domainWithoutSuffix || host, suffix: p.publicSuffix || "" };
}
export const isSaHost = (host) => host === "sa" || host.endsWith(".sa");
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");

export function looksSaudi(html, text, cfg) {
  const hay = normalize(text || "");
  let hits = 0;
  const found = [];
  for (const sig of cfg.saudiSignals) {
    if (hay.includes(normalize(sig))) { hits++; found.push(sig); }
  }
  if (/lang=["']?ar-sa/i.test(html || "")) { hits++; found.push("lang=ar-SA"); }
  return { saudi: hits >= 2, hits, found };
}

/* هل يصح فحص هذا المضيف أصلاً (لا عناوين IP أو نطاقات محلية إلا بالسماح) */
export function fetchable(host, allowLocal) {
  if (!host) return false;
  if (allowLocal) return true;
  if (isIp(host) || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  return host.includes(".");
}

export const safeName = (s) => s.toLowerCase().replace(/[^a-z0-9.-]+/g, "_");
