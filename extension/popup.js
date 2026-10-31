const $=s=>document.querySelector(s);
const DEF="https://saiprasdon.web.app/",OLD="https://nourahamads.github.io/reports/";
async function draw(){
 const st=await chrome.storage.local.get({batch:{items:[],pages:[]},toolUrl:DEF,busy:"",err:"",last:null}),b=st.batch,n=b.items.length;
 $("#n").textContent=n;
 const nb=new Set(b.items.map(i=>i.b).filter(Boolean)).size;
 $("#sub").textContent=n?`منتج · ${nb} علامة تجارية · ${b.pages.length} صفحة`+(st.last?` (آخر صفحة: +${st.last.added} جديد)`:""):"لا منتجات بعد";
 $("#pages").replaceChildren(...b.pages.map(p=>{const li=document.createElement("li");li.textContent=`${p.host||""} — ${p.added}/${p.found}`;li.title=p.url;return li}));
 $("#busy").textContent=st.busy;$("#err").textContent=st.err||"";$("#go").disabled=!!st.busy;
 for(const id of["send","copy","clear"])$("#"+id).disabled=!n;
 if(document.activeElement!==$("#url"))$("#url").value=st.toolUrl===OLD?DEF:st.toolUrl;
}
$("#go").onclick=async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});if(t)chrome.runtime.sendMessage({cmd:"collect",tabId:t.id})};
$("#send").onclick=()=>chrome.runtime.sendMessage({cmd:"send"});
$("#clear").onclick=()=>chrome.runtime.sendMessage({cmd:"clear"});
$("#copy").onclick=async()=>{const {batch:b}=await chrome.storage.local.get("batch");
 await navigator.clipboard.writeText(JSON.stringify({v:1,page:b.page,title:b.title,host:b.host,at:b.at,items:b.items}));$("#busy").textContent="تم النسخ ✓"};
$("#saveurl").onclick=async()=>{
 let u=$("#url").value.trim()||DEF;if(!/^https?:\/\//i.test(u))u="https://"+u;
 let o;try{o=new URL(u).origin}catch{$("#err").textContent="العنوان غير صالح";return}
 try{const ok=await chrome.permissions.request({origins:[o+"/*"]});if(!ok){$("#err").textContent="لم تُمنح صلاحية الوصول لهذا العنوان";return}}catch(e){$("#err").textContent=e.message;return}
 await chrome.storage.local.set({toolUrl:u,err:""});$("#busy").textContent="تم حفظ عنوان الأداة ✓";
};
chrome.storage.onChanged.addListener(draw);draw();
