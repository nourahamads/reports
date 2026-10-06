import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseFeed, build, feedUrl } from "../news.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("../config/news-sources.json", import.meta.url)));
const NOW = Date.parse("2026-10-06T12:00:00Z");
const rss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items.map((i) => `<item><title>${i.t}</title><link>${i.l}</link><pubDate>${i.d}</pubDate>${i.s ? `<source url="${i.su}">${i.s}</source>` : ""}${i.desc ? `<description>${i.desc}</description>` : ""}</item>`).join("")}</channel></rss>`;

test("تحليل RSS على نمط أخبار Google: إزالة اسم الناشر من العنوان وقراءة المصدر", () => {
  const [a] = parseFeed(rss([{ t: "الهيئة السعودية للملكية الفكرية تطلق حملة - صحيفة الرياض", l: "https://news.google.com/rss/articles/abc", d: "Mon, 05 Oct 2026 10:00:00 GMT", s: "صحيفة الرياض", su: "https://www.alriyadh.com" }]));
  assert.equal(a.title, "الهيئة السعودية للملكية الفكرية تطلق حملة");
  assert.equal(a.source, "صحيفة الرياض"); assert.equal(a.sourceUrl, "https://www.alriyadh.com"); assert.equal(a.url, "https://news.google.com/rss/articles/abc");
});
test("تحليل Atom", () => {
  const [a] = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><title>WIPO</title><entry><title>New treaty</title><link rel="alternate" href="https://wipo.int/n1"/><updated>2026-10-04T08:00:00Z</updated><summary>About treaty</summary></entry></feed>`);
  assert.equal(a.title, "New treaty"); assert.equal(a.url, "https://wipo.int/n1"); assert.equal(a.source, "WIPO");
});
test("رابط بحث أخبار Google يُبنى بترميز صحيح", () => {
  const u = new URL(feedUrl(cfg.feeds[0]));
  assert.equal(u.hostname, "news.google.com"); assert.ok(u.searchParams.get("q").includes("الملكية الفكرية")); assert.equal(u.searchParams.get("gl"), "SA");
});

test("build: يرشّح بالصلة والعمر والتكرار ويحفظ النطاق والموضوع", async () => {
  const fresh = "Mon, 05 Oct 2026 10:00:00 GMT", old = "Mon, 01 Jun 2026 10:00:00 GMT";
  const fetcher = async (url) => {
    const q = new URL(url).searchParams.get("q");
    if (q.includes("الهيئة السعودية للملكية الفكرية")) return rss([
      { t: "الهيئة السعودية للملكية الفكرية تضبط مخالفات قرصنة - سبق", l: "https://n/1", d: fresh, s: "سبق", su: "https://sabq.org" },
      { t: "الهيئة السعودية للملكية الفكرية تضبط مخالفات قرصنة - عكاظ", l: "https://n/1b", d: fresh, s: "عكاظ", su: "https://okaz.com.sa" }, // مكرر بالعنوان
      { t: "خبر رياضي بلا صلة - سبق", l: "https://n/2", d: fresh, s: "سبق", su: "https://sabq.org" },
      { t: "حملة قديمة للملكية الفكرية في السعودية - سبق", l: "https://n/3", d: old, s: "سبق", su: "https://sabq.org" },
    ]);
    if (q.includes("قرصنة OR")) return rss([{ t: "قرصنة بث في الأردن - موقع أردني", l: "https://n/4", d: fresh, s: "موقع أردني", su: "https://jo.example" }]); // ليس سعودياً
    if (q.includes("intellectual property")) return rss([{ t: "EU tightens copyright enforcement - Reuters", l: "https://n/5", d: fresh, s: "Reuters", su: "https://reuters.com" }]);
    if (q.includes("النيابة العامة")) return rss([{ t: "النيابة العامة تعلن إحالة قضايا - واس", l: "https://n/6", d: fresh, s: "واس", su: "https://spa.gov.sa" }]);
    throw new Error("HTTP 503");
  };
  const r = await build(cfg, fetcher, NOW);
  const titles = r.items.map((i) => i.title);
  assert.ok(titles.includes("الهيئة السعودية للملكية الفكرية تضبط مخالفات قرصنة"));
  assert.equal(titles.filter((t) => t.startsWith("الهيئة السعودية")).length, 1, "التكرار");
  assert.ok(!titles.some((t) => t.includes("رياضي")), "بلا صلة");
  assert.ok(!titles.some((t) => t.includes("قديمة")), "قديم");
  assert.ok(!titles.some((t) => t.includes("الأردن")), "غير سعودي");
  const eu = r.items.find((i) => i.url === "https://n/5"); assert.equal(eu.scope, "عالمي"); assert.equal(eu.topic, "ip");
  const pp = r.items.find((i) => i.url === "https://n/6"); assert.equal(pp.topic, "prosecution"); assert.equal(pp.topicName, "النيابة العامة"); assert.equal(pp.sourceUrl, "https://spa.gov.sa");
  assert.ok(r.feeds.some((f) => !f.ok), "الفشل الجزئي يُسجَّل ولا يوقف الباقي");
  assert.ok(r.items.every((i, k, a) => k === 0 || a[k - 1].date >= i.date), "الأحدث أولاً");
});
