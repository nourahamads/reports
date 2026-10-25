/**
 * واجهة حفظ المواقع والتقارير في Google Sheet.
 * يُلصق هذا الملف في Apps Script المرتبط بالجدول (الإضافات ← Apps Script)، ثم: نشر ← نشر جديد ← تطبيق ويب.
 */
const TOKEN = "غيّر-هذا-الرمز-إلى-نص-سري-طويل";

const TABLES = {
  sites:   { name: "المواقع",  cols: ["id", "name", "url", "cat", "file", "meta", "addedAt"],
             labels: ["المعرّف", "الاسم", "الرابط", "التصنيف", "الملف", "تفاصيل (JSON)", "تاريخ الإضافة"] },
  reports: { name: "التقارير", cols: ["id", "date", "site", "url", "types", "result", "source", "inspector", "content", "subUrl", "evidence", "notes", "sectors", "siteId", "screenshot", "extra", "_types"],
             labels: ["المعرّف", "التاريخ والوقت", "الموقع", "الرابط", "نوع المحتوى", "النتيجة", "المصدر", "المفتش", "المحتوى", "الرابط الفرعي", "الدليل", "ملاحظات", "القطاع", "معرّف الموقع", "اللقطة", "تفاصيل (JSON)", "الأنواع (JSON)"] },
};

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(key) {
  const t = TABLES[key], ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(t.name);
  if (!s) { s = ss.insertSheet(t.name); s.appendRow(t.labels); s.setFrozenRows(1); s.setRightToLeft(true); }
  return s;
}

function cell_(v) {
  if (v == null) return "";
  if (typeof v === "object") v = JSON.stringify(v);
  v = String(v);
  if (/^[=+\-@]/.test(v)) v = "'" + v;   // منع تنفيذ الصيغ
  return v.length > 40000 ? v.slice(0, 40000) : v;
}

function doGet(e) {
  if (!e.parameter || e.parameter.token !== TOKEN) return json_({ ok: false, error: "unauthorized" });
  const out = {};
  for (const key in TABLES) {
    const s = sheet_(key), cols = TABLES[key].cols, n = s.getLastRow() - 1;
    out[key] = n < 1 ? [] : s.getRange(2, 1, n, cols.length).getValues().map(function (r) {
      const o = {}; cols.forEach(function (c, i) { o[c] = r[i]; }); return o;
    });
  }
  return json_({ ok: true, data: out });
}

function doPost(e) {
  let body; try { body = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: "bad json" }); }
  if (body.token !== TOKEN) return json_({ ok: false, error: "unauthorized" });
  const t = TABLES[body.table]; if (!t) return json_({ ok: false, error: "bad table" });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = sheet_(body.table);
    if (body.action === "add") {
      const rows = (body.rows || []).map(function (r) { return t.cols.map(function (c) { return cell_(r[c]); }); });
      if (rows.length) s.getRange(s.getLastRow() + 1, 1, rows.length, t.cols.length).setValues(rows);
      return json_({ ok: true, added: rows.length });
    }
    if (body.action === "delete") {
      const ids = s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(body.id)) s.deleteRow(i + 2);
      return json_({ ok: true });
    }
    if (body.action === "clear") {
      if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "bad action" });
  } finally { lock.releaseLock(); }
}
