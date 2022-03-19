#!/bin/bash
DIRNAME=$(dirname "$0")

sudo systemctl stop transportvic
sudo systemctl restart mongod
node "$DIRNAME/timetable-updating-server/index.js" | tee "$DIRNAME/updater-log.txt"
sudo systemctl restart mongod
sudo systemctl start transportvic
