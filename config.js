// إعدادات الموقع.
// requireLogin: false يعطّل تسجيل الدخول (الحالي)؛ true يطلب تسجيل الدخول بحسابات محلية داخل المتصفح.
// idleMinutes: مدة الخمول قبل تسجيل الخروج تلقائياً.
// reportLogo: مسار شعار الهيئة في تقرير PDF (الافتراضي assets/saip-logo.png).
// supabaseUrl/anonKey: عند ضبطهما يُستبدل الدخول المحلي بحسابات قاعدة البيانات المشتركة (supabase/schema.sql).
window.CFG = {
  requireLogin: false,
  idleMinutes: 30,
  reportLogo: "assets/saip-logo.png",
  sheetUrl: "https://script.google.com/macros/s/AKfycbxifANT3Xmz9fIXETNvMlW3V7L5EeREO_jgS1nHZ-YrTWlPc09LI-Xz9ISEbqn2bxqDRg/exec",     // رابط تطبيق الويب (Apps Script) ينتهي بـ /exec لحفظ المواقع والتقارير في Google Sheet
  sheetToken: "",   // الرمز السري المطابق لـ TOKEN في google-sheet/Code.gs
  supabaseUrl: "",
  anonKey: ""
};
