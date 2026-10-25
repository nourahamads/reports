#!/usr/bin/env bash
# نشر الموقع على Firebase Hosting. الاستخدام: ./deploy.sh معرّف-المشروع
set -euo pipefail
[ $# -ge 1 ] || { echo "الاستخدام: ./deploy.sh <project-id>"; exit 1; }
cd "$(dirname "$0")"
rm -rf _site && mkdir _site
cp -r index.html config.js vendor data assets _site/
node extension/build.mjs
(cd extension && zip -qr ../_site/ipw-extension.zip . -x build.mjs)
npx -y firebase-tools deploy --only hosting --project "$1"
