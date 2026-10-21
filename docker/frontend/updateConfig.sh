#!/bin/sh
cd  /usr/share/nginx/html

echo "use backend url ${MONKEYTYPE_BACKENDURL}"
sed -i "s/###MONKEYTYPE_BACKENDURL###/${MONKEYTYPE_BACKENDURL//\//\\/}/g" js/*.js

echo "use progcomp api url ${PROGCOMP_API_URL}"
sed -i "s/###PROGCOMP_API_URL###/${PROGCOMP_API_URL//\//\\/}/g" js/*.js
