const DEF_URL="https://nourahamads.github.io/reports/";
const get=async()=>(await chrome.storage.local.get({batch:{items:[],pages:[]},toolUrl:DEF_URL,busy:""}));
const norm=u=>{u=(u||"").trim();if(!u)return DEF_URL;if(!/^https?:\/\//i.test(u))u="https://"+u;return u.endsWith("/")||/\.html?$/.test(u)?u:u+"/"};
async function brands(url){
 try{const r=await fetch(new URL("data/brands.json",url).href,{cache:"no-store"});if(r.ok)return (await r.json()).brands}catch{}
 return (await (await fetch(chrome.runtime.getURL("brands.json"))).json()).brands;
}
async function setBadge(n){await chrome.action.setBadgeText({text:n?String(n):""});await chrome.action.setBadgeBackgroundColor({color:"#0f6b5c"})}
async function collect(tabId){
 const st=await get();await chrome.storage.local.set({busy:"جارٍ التمرير وجمع المنتجات…",err:""});
 try{
  const tab=await chrome.tabs.get(tabId);
  if(!/^https?:/.test(tab.url||""))throw new Error("افتح صفحة متجر (http/https) ثم أعد المحاولة");
  const B=await brands(st.toolUrl);
  await chrome.scripting.executeScript({target:{tabId},files:["collector.js"]});
  const [{result}]=await chrome.scripting.executeScript({target:{tabId},args:[B],func:async b=>await window.__ipwCollect(b,{quiet:true})});
  if(!result||!result.items)throw new Error("لم تُرجع الصفحة نتيجة");
  const cur=(await get()).batch,seen=new Set(cur.items.map(i=>i.u||(i.n+"|"+i.p)));let add=0;
  for(const it of result.items){const k=it.u||(it.n+"|"+it.p);if(seen.has(k))continue;seen.add(k);cur.items.push(it);add++}
  cur.pages.push({url:result.page,title:result.title,host:result.host,found:result.items.length,added:add,at:result.at});
  if(!cur.page){cur.page=result.page;cur.title=result.title;cur.host=result.host;cur.at=result.at}
  await chrome.storage.local.set({batch:cur,busy:"",last:{found:result.items.length,added:add}});await setBadge(cur.items.length);
 }catch(e){await chrome.storage.local.set({busy:"",err:e.message||String(e)})}
}
async function send(){
 const st=await get(),b=st.batch;if(!b.items.length)return;
 const url=norm(st.toolUrl),pattern=new URL(url).origin+new URL(url).pathname.replace(/[^/]*$/,"")+"*";
 let tab;try{[tab]=await chrome.tabs.query({url:pattern})}catch{}
 if(tab){await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true})}
 else tab=await chrome.tabs.create({url});
 const data={v:1,page:b.page,title:b.title,host:b.host,at:b.at,items:b.items};
 for(let i=0;i<25;i++){
  const t=await chrome.tabs.get(tab.id);
  if(t.status==="complete"){try{const r=await chrome.tabs.sendMessage(tab.id,{type:"ipw-products",data});if(r&&r.ok){await chrome.storage.local.set({sent:Date.now(),err:""});return}}catch{}}
  await new Promise(r=>setTimeout(r,800));
 }
 await chrome.storage.local.set({err:"تعذر الوصول إلى صفحة الأداة. تأكد من العنوان أو استخدم «نسخ النتيجة»."});
}
chrome.runtime.onMessage.addListener((m,_s,reply)=>{
 if(m.cmd==="collect")collect(m.tabId).then(()=>reply({}));
 else if(m.cmd==="send")send().then(()=>reply({}));
 else if(m.cmd==="clear")chrome.storage.local.set({batch:{items:[],pages:[]},last:null,err:"",busy:""}).then(()=>setBadge(0)).then(()=>reply({}));
 else return false;
 return true;
});
chrome.runtime.onStartup.addListener(async()=>setBadge((await get()).batch.items.length));
