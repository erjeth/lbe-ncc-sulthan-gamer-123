#!/bin/sh
set -e
 
MEMBER_NAME=${1:-$(whoami)}
 
echo "MEMBER_NAME=$MEMBER_NAME" > .env
echo "Set MEMBER_NAME=$MEMBER_NAME in .env"
 
docker compose up -d
 
echo "Stack started. Current status:"
docker compose ps
 
