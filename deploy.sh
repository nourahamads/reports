#!/usr/bin/env bash
# نشر الموقع على Firebase Hosting. الاستخدام: ./deploy.sh معرّف-المشروع
set -euo pipefail
[ $# -ge 1 ] || { echo "الاستخدام: ./deploy.sh <project-id>"; exit 1; }
cd "$(dirname "$0")"
rm -rf _site && mkdir _site
cp -r index.html config.js vendor data assets saudi-market _site/
node extension/build.mjs
# قيم لا تُحفظ في المستودع تُمرَّر وقت النشر: SHEET_TOKEN و PROACTIVE_SHEET
python3 - <<'PY'
import os,re,json
p="_site/config.js";s=open(p,encoding="utf8").read()
for env,key in (("SHEET_TOKEN","sheetToken"),("PROACTIVE_SHEET","proactiveSheet")):
    v=os.environ.get(env)
    if v:
        s,n=re.subn(key+r':\s*"[^"]*"',lambda m:key+": "+json.dumps(v,ensure_ascii=False),s,count=1)
        assert n==1,key+" غير موجود في config.js"
open(p,"w",encoding="utf8").write(s)
PY
(cd extension && zip -qr ../_site/ipw-extension.zip . -x build.mjs)
npx -y firebase-tools deploy --only hosting --project "$1"
