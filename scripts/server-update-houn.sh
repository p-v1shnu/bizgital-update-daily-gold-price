#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/server-update-houn.sh
#
# This script is intended to run on the Ubuntu server
# where PM2 process name is "gold-price-editor".

APP_DIR="/home/automation-hub-sgp01/UpdateDailyGoldPrice"
PM2_NAME="gold-price-editor"

echo "==> go to app dir"
cd "$APP_DIR"

echo "==> current branch + latest commit"
git branch --show-current
git log --oneline -n 1

echo "==> pull latest code"
git pull

echo "==> install dependencies"
npm install

echo "==> restart pm2 app with fresh env"
pm2 restart "$PM2_NAME" --update-env

echo "==> verify app is online"
pm2 ls
pm2 logs "$PM2_NAME" --lines 30 --nostream

echo "==> verify server.js contains Houn keys"
grep -n "printSellFiveHoun\|printBuyFiveHoun\|print_sell_five_houn\|print_buy_five_houn" server.js

echo "==> done"
