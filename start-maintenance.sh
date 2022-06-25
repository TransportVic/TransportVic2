#!/bin/bash
DIRNAME=$(dirname "$0")

sudo systemctl stop transportvic
sudo systemctl restart mongod
node "$DIRNAME/timetable-updating-server/index.js" 2>&1 | tee "$DIRNAME/updater-log.txt"
sudo systemctl restart mongod
sudo systemctl start transportvic
