#!/bin/sh

TARGET_MEMBER=${MEMBER_NAME:-daffa}

echo "Menjalankan portofolio untuk: $TARGET_MEMBER"

rm -rf /usr/share/nginx/html/*

if [ -d "/app/site_$TARGET_MEMBER/src" ]; then
    cp -r /app/site_$TARGET_MEMBER/src/* /usr/share/nginx/html/
else
    echo "Folder /app/site_$TARGET_MEMBER/src tidak ditemukan!"
fi

exec nginx -g 'daemon off;'

HOSTNAME_VAL=$(hostname)

echo "halo.dek = { hostname: \"${HOSTNAME_VAL}\" };" > /var/www/html/config.js