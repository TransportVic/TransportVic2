#!/bin/bash
DIRNAME=$(dirname "$0")

sudo systemctl stop server
sudo node "$DIRNAME/timetable-updating-server/index.js" | sudo tee "$DIRNAME/updater-log.txt"
sudo systemctl restart mongod
sudo systemctl start server
