/* تطبيع النص العربي/الإنجليزي للمطابقة: حذف التشكيل والتطويل، توحيد الألف والياء والتاء المربوطة */
export function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}
