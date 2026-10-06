import { chromium } from "playwright";

/** متصفح بلا واجهة مشترك بين الفحص الدوري وخادم فحص الملفات */
export async function createInspector(cfg, kw, { allowLocal = false, shotQuality = 70 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ userAgent: cfg.userAgent, viewport: { width: 1366, height: 768 }, locale: "ar-SA", acceptDownloads: false, ignoreHTTPSErrors: true });
  context.on("page", async (p) => { if (await p.opener().catch(() => null)) p.close().catch(() => {}); }); // منع النوافذ المنبثقة
  const streamRe = new RegExp(kw.streamRequestPattern, "i");

  /** urls: مرشحون بالترتيب (مثلاً https ثم http). */
  async function inspect(urls) {
    const page = await context.newPage();
    let streamRequests = 0;
    await page.route("**/*", (route) => {
      const req = route.request();
      if (streamRe.test(req.url())) { streamRequests++; return route.abort(); }
      if (req.resourceType() === "media") return route.abort(); // لا نحمّل الوسائط
      return route.continue();
    });
    try {
      let resp, err;
      for (const u of urls) {
        try { resp = await page.goto(u, { waitUntil: "domcontentloaded", timeout: cfg.pageTimeoutMs }); break; } catch (e) { err = e; }
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
      const shot = Buffer.from(await page.screenshot({ type: "jpeg", quality: shotQuality }));
      return { ok: true, info: { ...info, streamRequests }, finalUrl: page.url(), shot, status: resp.status() };
    } catch (e) {
      return { ok: false, error: String(e.message || e).split("\n")[0].slice(0, 160) };
    } finally {
      await page.close().catch(() => {});
    }
  }
  return { inspect, close: () => browser.close() };
}
