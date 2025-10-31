#!/bin/bash
DIRNAME=$(dirname "$0")

cd $DIRNAME/..
. ./.env

npm i -d
sudo systemctl restart mongod
sudo systemctl restart mongod-trip
node scripts/update-gtfs.mjs
sudo systemctl restart mongod
sudo systemctl restart transportvic