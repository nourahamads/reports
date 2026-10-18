/* يولّد collector.js وbrands.json من الأداة نفسها حتى يبقى المنطق واحداً. شغّله: node extension/build.mjs */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const html=readFileSync(join(root,"index.html"),"utf8");
const a=html.indexOf("async function collectProducts(BRANDS");
const b=html.indexOf("let BRANDS_CACHE",a);
if(a<0||b<0)throw new Error("collectProducts not found");
writeFileSync(join(root,"extension","collector.js"),"/* مولَّد آلياً من index.html عبر build.mjs — لا تعدّله يدوياً */\n"+html.slice(a,b).trim()+"\nwindow.__ipwCollect=collectProducts;\n");
writeFileSync(join(root,"extension","brands.json"),readFileSync(join(root,"data","brands.json")));
console.log("ok");
