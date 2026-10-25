#!/usr/bin/env bash
# نشر الموقع على Firebase Hosting. الاستخدام: ./deploy.sh معرّف-المشروع
set -euo pipefail
[ $# -ge 1 ] || { echo "الاستخدام: ./deploy.sh <project-id>"; exit 1; }
cd "$(dirname "$0")"
rm -rf _site && mkdir _site
cp -r index.html config.js vendor data assets _site/
node extension/build.mjs
# الرمز السري لـ Google Sheet لا يُحفظ في المستودع: يُمرَّر هنا وقت النشر فقط (SHEET_TOKEN="..." ./deploy.sh ...)
if [ -n "${SHEET_TOKEN:-}" ]; then
  python3 - "$SHEET_TOKEN" <<'PY'
import sys,re
p="_site/config.js";s=open(p,encoding="utf8").read()
t=sys.argv[1].replace("\\","\\\\").replace('"','\\"')
s,n=re.subn(r'sheetToken:\s*"[^"]*"','sheetToken: "'+t.replace("\\","\\\\")+'"',s,count=1)
assert n==1,"sheetToken غير موجود في config.js"
open(p,"w",encoding="utf8").write(s)
PY
fi
(cd extension && zip -qr ../_site/ipw-extension.zip . -x build.mjs)
npx -y firebase-tools deploy --only hosting --project "$1"
