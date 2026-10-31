/* يمرّر النتيجة من الإضافة إلى صفحة الأداة (نفس المتصفح فقط؛ لا شبكة) */
if(!window.__ipwBridge){
 window.__ipwBridge=true;
 chrome.runtime.onMessage.addListener((m,_s,reply)=>{
  if(m&&m.type==="ipw-products"){window.postMessage({type:"ipw-products",data:m.data},location.origin);reply({ok:true})}
 });
}
