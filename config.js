// إعدادات الموقع.
// requireLogin: true (الافتراضي) يطلب تسجيل الدخول بحسابات محلية داخل المتصفح؛ false يعطّله.
// idleMinutes: مدة الخمول قبل تسجيل الخروج تلقائياً.
// reportLogo: مسار شعار الهيئة في تقرير PDF (الافتراضي assets/saip-logo.png).
// supabaseUrl/anonKey: عند ضبطهما يُستبدل الدخول المحلي بحسابات قاعدة البيانات المشتركة (supabase/schema.sql).
window.CFG = {
  requireLogin: true,
  idleMinutes: 30,
  reportLogo: "assets/saip-logo.png",
  supabaseUrl: "",
  anonKey: ""
};
