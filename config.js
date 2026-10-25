// إعدادات الموقع.
// requireLogin: false يعطّل تسجيل الدخول (الحالي)؛ true يطلب تسجيل الدخول بحسابات محلية داخل المتصفح.
// idleMinutes: مدة الخمول قبل تسجيل الخروج تلقائياً.
// reportLogo: مسار شعار الهيئة في تقرير PDF (الافتراضي assets/saip-logo.png).
// supabaseUrl/anonKey: عند ضبطهما يُستبدل الدخول المحلي بحسابات قاعدة البيانات المشتركة (supabase/schema.sql).
window.CFG = {
  requireLogin: false,
  idleMinutes: 30,
  reportLogo: "assets/saip-logo.png",
  supabaseUrl: "",
  anonKey: ""
};
