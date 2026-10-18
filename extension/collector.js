/* مولَّد آلياً من index.html عبر build.mjs — لا تعدّله يدوياً */
async function collectProducts(BRANDS,opts){
 const D=document,W=window,AR="٠١٢٣٤٥٦٧٨٩",FA="۰۱۲۳۴۵۶۷۸۹";
 const lat=s=>String(s==null?"":s).replace(/[٠-٩]/g,d=>AR.indexOf(d)).replace(/[۰-۹]/g,d=>FA.indexOf(d)).replace(/٬/g,",").replace(/٫/g,".");
 const clean=s=>String(s==null?"":s).replace(/\s+/g," ").trim();
 const norm=s=>lat(s).replace(/[\u064B-\u065F\u0640]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase();
 const abs=u=>{try{return u?new URL(u,location.href).href:""}catch(e){return ""}};
 const AL="(?<![\\u0600-\\u06FF])",AR_="(?![\\u0600-\\u06FF])";
 const CUR={SAR:new RegExp("(\\bSAR\\b|\\bSR\\b|\u20C1|"+AL+"ر\\.?\\s?س\\.?"+AR_+"|ريال|﷼)","i"),USD:/(\bUSD\b|\$|دولار)/i,AED:new RegExp("(\\bAED\\b|درهم|"+AL+"د\\.?\\s?إ\\.?"+AR_+")","i"),EUR:/(\bEUR\b|€|يورو)/i,GBP:/(\bGBP\b|£)/i,KWD:/(\bKWD\b|دينار)/i,EGP:new RegExp("(\\bEGP\\b|"+AL+"ج\\.?\\s?م\\.?"+AR_+")","i")};
 const curOf=t=>{for(const k in CUR)if(CUR[k].test(t))return k;return ""};
 const parsePrice=t=>{
  t=lat(t);const m=t.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?/);if(!m)return null;
  let n=m[0];n=/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(n)?n.replace(/,/g,""):n.replace(",",".");
  const v=parseFloat(n);return isFinite(v)&&v>0?{p:v,c:curOf(t)}:null;
 };
 const hasPrice=t=>{t=lat(t);return t.length<=48&&/\d/.test(t)&&!!curOf(t)};
 const numOnly=e=>/^\s*\d[\d,.\s]*$/.test(lat(e.textContent))&&!!e.closest("[class*=price i],[class*=Price],[class*=amount i],[itemprop=price]")&&!!e.querySelector("svg,img,i")||/^\s*\d[\d,.\s]*$/.test(lat(e.textContent))&&!!e.parentElement&&!!e.parentElement.querySelector(":scope>svg,:scope>img,:scope>i,:scope>[class*=currency i],:scope>[class*=riyal i],:scope>[class*=sar i]");
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const BR=(BRANDS||[]).map(b=>({n:b.name,cs:!!b.cs,a:[b.name].concat(b.aliases||[]).map(a=>({raw:a,re:b.cs?new RegExp("(^|[^\\p{L}\\p{N}])"+esc(a)+"($|[^\\p{L}\\p{N}])","u"):null,n:" "+norm(a).replace(/[^\p{L}\p{N}&']+/gu," ").trim()+" "}))}));
 const matchBrand=text=>{
  const raw=clean(text),nt=" "+norm(raw).replace(/[^\p{L}\p{N}&']+/gu," ")+" ";let best=null;
  for(const b of BR)for(const a of b.a){
   const ok=b.cs?a.re.test(raw):(a.n.length>3&&nt.includes(a.n));
   if(ok&&(!best||a.raw.length>best.l))best={n:b.n,l:a.raw.length};
  }
  return best?best.n:"";
 };
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 let last=0,same=0;
 for(let i=0;i<14&&same<2;i++){W.scrollTo(0,D.documentElement.scrollHeight);await sleep(700);const h=D.documentElement.scrollHeight;if(h===last)same++;else{same=0;last=h}}
 W.scrollTo(0,0);
 const items=[],seen=new Set();
 const add=o=>{
  if(!o||!o.n)return;o.n=clean(o.n).slice(0,200);if(o.n.length<2)return;
  const key=o.u||(norm(o.n)+"|"+o.p);if(seen.has(key))return;seen.add(key);
  const raw=clean(o.b0||"");let b=raw?(matchBrand(raw)||raw.slice(0,40)):"";let bs=raw?(o.bs||"schema"):"";
  if(!b){b=matchBrand(o.n+" "+(o.alt||"")+" "+decodeURIComponent((o.u||"").replace(/%(?![0-9a-f]{2})/gi,"")));if(b)bs="dict"}
  items.push({n:o.n,p:o.p==null?null:o.p,c:o.c||"",i:o.i||"",u:o.u||"",b:b,bs:bs});
 };
 /* 1) بيانات منظمة JSON-LD */
 const walk=(x,d)=>{
  if(!x||d>9)return;if(Array.isArray(x)){x.forEach(y=>walk(y,d+1));return}
  if(typeof x!=="object")return;
  if(/Product/i.test([].concat(x["@type"]||[]).join(","))){
   let off=[].concat(x.offers||[])[0]||{};if(off.offers)off=[].concat(off.offers)[0]||off;
   const pv=off.price!=null?off.price:(off.lowPrice!=null?off.lowPrice:off.highPrice),pr=pv!=null?parsePrice(String(pv)):null;
   let img=[].concat(x.image||[])[0];if(img&&typeof img==="object")img=img.url||img.contentUrl;
   add({n:x.name,p:pr?pr.p:null,c:off.priceCurrency||"",i:abs(img||""),u:abs(x.url||off.url||""),b0:x.brand?(typeof x.brand==="string"?x.brand:x.brand.name):"",bs:"schema"});
  }
  for(const k in x){if(k==="@context")continue;const v=x[k];if(v&&typeof v==="object")walk(v,d+1)}
 };
 D.querySelectorAll('script[type="application/ld+json"]').forEach(s=>{try{walk(JSON.parse(s.textContent),0)}catch(e){}});
 /* 2) بطاقات المنتجات في الصفحة: حاويات فيها صورة وسعر */
 const all=[...D.querySelectorAll("body *")].filter(e=>!/^(SCRIPT|STYLE|NOSCRIPT|IFRAME|SVG|PATH|HEAD)$/i.test(e.tagName));
 const priceEls=all.filter(e=>{const t=e.textContent;if(!t||t.length>60)return false;if(!hasPrice(t)&&!(![...e.children].some(c=>/\d/.test(c.textContent))&&numOnly(e)))return false;for(const c of e.children)if(hasPrice(c.textContent))return false;return true});
 const hasImg=c=>c.querySelector("img,picture,[style*='background-image']");
 let cards=[];
 for(const pe of priceEls){
  let c=pe,f=null;
  for(let i=0;i<8&&c.parentElement&&c.parentElement!==D.body;i++){c=c.parentElement;if(hasImg(c)){f=c;break}}
  if(!f||cards.includes(f)||priceEls.filter(x=>f.contains(x)).length>3||f.closest("header,footer,nav,[role=banner],[role=navigation]"))continue;
  const r=f.getBoundingClientRect();if(r.width>760||r.height>1100)continue;
  cards.push(f);
 }
 cards=cards.filter(c=>!cards.some(o=>o!==c&&c.contains(o)));
 /* إن وُجدت بطاقات متكررة بنفس البنية فهي المنتجات؛ نستبعد العناصر المنفردة (بنرات، فلاتر) */
 const sig=c=>c.tagName+"|"+[].slice.call(c.classList).sort().join(".");
 const cnt={};cards.forEach(c=>{cnt[sig(c)]=(cnt[sig(c)]||0)+1});
 if(Math.max(0,...Object.values(cnt))>=3)cards=cards.filter(c=>cnt[sig(c)]>=2);
 const nameOf=c=>{
  for(const e of c.querySelectorAll("h1,h2,h3,h4,h5,h6,[itemprop=name],[class*=title],[class*=Title],[class*=name],[class*=Name],a[title]")){
   const t=clean(e.textContent)||(e.tagName==="A"?clean(e.getAttribute("title")):"");
   if(t.length>=2&&t.length<=160&&!hasPrice(t)&&!/^[\d\s.,]+$/.test(t))return t;
  }
  const im=c.querySelector("img[alt]");if(im&&clean(im.alt).length>=2)return clean(im.alt);
  let best="";c.querySelectorAll("a").forEach(a=>{const t=clean(a.textContent);if(t.length>best.length&&t.length<=160&&!hasPrice(t))best=t});return best;
 };
 const imgOf=c=>{
  for(const im of c.querySelectorAll("img")){
   const ss=im.getAttribute("srcset")||im.getAttribute("data-srcset")||"";
   for(const u of [im.getAttribute("data-src"),im.getAttribute("data-lazy-src"),im.getAttribute("data-original"),ss.split(",")[0].trim().split(" ")[0],im.currentSrc,im.getAttribute("src")]){
    if(u&&!/^data:/i.test(u))return abs(u);
   }
  }
  const bg=c.querySelector("[style*='background-image']");if(bg){const m=(bg.getAttribute("style")||"").match(/url\(["']?([^"')]+)/);if(m)return abs(m[1])}
  return "";
 };
 for(const c of cards){
  const els=priceEls.filter(x=>c.contains(x));
  const pick=els.find(x=>!x.closest("del,s,strike,[class*=old],[class*=before],[class*=was],[class*=compare],[class*=regular]"))||els[0];
  const pr=pick?parsePrice(pick.textContent):null;
  const a=c.matches("a[href]")?c:c.querySelector("a[href]");
  const be=c.querySelector("[itemprop=brand],[class*=brand],[class*=Brand],[class*=vendor],[data-brand]");
  const bt=be?clean(be.getAttribute("data-brand")||be.textContent):"";
  const im=c.querySelector("img[alt]");
  add({n:nameOf(c),p:pr?pr.p:null,c:pr?pr.c:"",i:imgOf(c),u:a?abs(a.getAttribute("href")):"",b0:bt.length&&bt.length<=40?bt:"",bs:"dom",alt:im?im.alt:""});
 }
 /* 3) صفحة منتج واحد */
 if(!items.length){
  const mt=n=>{const e=D.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]');return e?e.getAttribute("content"):""};
  const price=mt("product:price:amount")||mt("og:price:amount"),h1=D.querySelector("h1");
  add({n:mt("og:title")||(h1?h1.textContent:D.title),p:price?(parsePrice(price)||{}).p:null,c:mt("product:price:currency")||mt("og:price:currency"),i:abs(mt("og:image")),u:location.href,b0:mt("product:brand")||mt("og:brand"),bs:"meta"});
 }
 const out={v:1,page:location.href,title:D.title,host:location.hostname,at:new Date().toISOString(),items:items};
 W.__products=out;
 if(opts&&opts.quiet)return out;
 /* لوحة النتيجة */
 const json=JSON.stringify(out),nb=new Set(items.map(x=>x.b).filter(Boolean)).size;
 const box=D.createElement("div");box.setAttribute("dir","rtl");
 box.style.cssText="position:fixed;top:12px;right:12px;z-index:2147483647;background:#fff;color:#111;border:2px solid #0f6b5c;border-radius:10px;padding:12px 14px;font:14px/1.7 system-ui,sans-serif;max-width:320px;box-shadow:0 6px 24px rgba(0,0,0,.3)";
 const t=D.createElement("div");t.style.fontWeight="700";t.textContent="تم جمع "+items.length+" منتج · "+nb+" علامة تجارية";box.appendChild(t);
 const btn=(txt,fn)=>{const b=D.createElement("button");b.textContent=txt;b.style.cssText="margin:8px 6px 0 0;padding:6px 12px;border:1px solid #0f6b5c;border-radius:8px;background:#0f6b5c;color:#fff;cursor:pointer;font:inherit";b.onclick=fn;box.appendChild(b);return b};
 const cp=btn("نسخ النتيجة",()=>{const done=()=>{cp.textContent="تم النسخ ✓"};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(json).then(done,()=>fb());else fb();
  function fb(){const ta=D.createElement("textarea");ta.value=json;ta.style.cssText="position:fixed;opacity:0";D.body.appendChild(ta);ta.select();try{D.execCommand("copy");done()}catch(e){cp.textContent="تعذر النسخ"}ta.remove()}});
 btn("تنزيل",()=>{const a=D.createElement("a");a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));a.download="products-"+location.hostname+".json";D.body.appendChild(a);a.click();a.remove()});
 btn("إغلاق",()=>box.remove());
 D.body.appendChild(box);
 return out;
}
window.__ipwCollect=collectProducts;
