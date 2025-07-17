#!/bin/bash
DIRNAME=$(dirname "$0")

cd $DIRNAME
. $DIRNAME/.env

sudo systemctl restart mongod
node timetable-updating-server/index.mjs
sudo systemctl restart mongod
sudo systemctl restart transportvic