#!/bin/bash
DIRNAME=$(dirname "$0")

sudo systemctl stop server
sudo node "$DIRNAME/timetable-updating-server/index.js" > "$DIRNAME/updater-log.txt"
sudo systemctl start server
