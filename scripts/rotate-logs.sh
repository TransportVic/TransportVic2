#!/bin/bash
DIRNAME=$(dirname "$0")

cd $DIRNAME/..
. ./.env

sudo chmod a+rw -R /var/log/mongodb/
node $DIRNAME/js/rotate-logs.mjs