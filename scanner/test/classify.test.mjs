import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classify, isSaHost, looksSaudi, registrable } from "../lib.mjs";

const kw = JSON.parse(fs.readFileSync(new URL("../config/keywords.json", import.meta.url)));
const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), "utf8");
const toPage = (html, extra = {}) => ({
  title: (html.match(/<title>(.*?)<\/title>/s) || [, ""])[1],
  headings: [...html.matchAll(/<h1>(.*?)<\/h1>/g)].map((m) => m[1]).join(" "),
  meta: (html.match(/content="([^"]*)"/) || [, ""])[1],
  text: html.replace(/<[^>]+>/g, " "),
  ...extra,
});

test("بث مباشر للمباريات => مخالف درجة أولى", () => {
  const r = classify(toPage(fx("live"), { streamRequests: 1, hasPlayer: true }), kw);
  assert.equal(r.tier, 1); assert.equal(r.verdict, "مخالف"); assert.ok(r.types.includes("بث مباشر للمباريات"));
});
test("متجر اشتراكات IPTV => مخالف + متجر", () => {
  const r = classify(toPage(fx("iptv")), kw);
  assert.equal(r.tier, 1); assert.ok(r.types.includes("بث مشفّر (IPTV)")); assert.ok(r.types.includes("متجر / اشتراكات"));
});
test("خبر يذكر IPTV مرة واحدة => ليس مخالفاً", () => {
  const r = classify(toPage(fx("news")), kw);
  assert.equal(r.tier, 0);
});
test("أفلام ومسلسلات => للمراجعة (درجة ثانية)", () => {
  const r = classify(toPage(fx("movies")), kw);
  assert.equal(r.tier, 2); assert.equal(r.verdict, "للمراجعة");
});
test("متجر عادي => غير مخالف", () => {
  const r = classify(toPage(fx("store")), kw);
  assert.equal(r.tier, 0); assert.equal(r.verdict, "غير مخالف");
});
test("النطاق: .sa و com.sa و المؤشرات السعودية", () => {
  assert.ok(isSaHost("shop.com.sa")); assert.ok(isSaHost("a.sa")); assert.ok(!isSaHost("a.com"));
  assert.equal(registrable("live.example.com.sa").label, "example");
  assert.ok(looksSaudi("", "الرياض ر.س", kw).saudi);
  assert.ok(!looksSaudi("", "Prices in USD", kw).saudi);
  assert.ok(!looksSaudi("", fs.readFileSync(new URL("./fixtures/foreign.html", import.meta.url), "utf8"), kw).saudi);
});
