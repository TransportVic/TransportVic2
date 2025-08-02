#!/bin/bash
DIRNAME=$(dirname "$0")

cd $DIRNAME/..
. $DIRNAME/.env

sudo systemctl restart mongod
node scripts/update-gtfs.mjs
sudo systemctl restart mongod
sudo systemctl restart transportvic