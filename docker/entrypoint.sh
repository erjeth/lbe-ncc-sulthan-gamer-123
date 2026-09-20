#!/bin/sh

TARGET_MEMBER=${MEMBER_NAME:-daffa}

echo "Menjalankan portofolio untuk: $TARGET_MEMBER"

rm -rf /usr/share/nginx/html/*

if [ -d "/app/site_$TARGET_MEMBER/src" ]; then
    cp -r /app/site_$TARGET_MEMBER/src/* /usr/share/nginx/html/
else
    echo "Folder /app/site_$TARGET_MEMBER/src tidak ditemukan!"
fi

echo "halo.dek = { hostname: \"${TARGET_MEMBER}\" };" > /usr/share/nginx/html/config.js

exec nginx -g 'daemon off;'