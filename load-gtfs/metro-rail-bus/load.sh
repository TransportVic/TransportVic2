#!/bin/bash
DIRNAME=$(dirname "$0")
. $HOME/.bash_profile

node $DIRNAME/download-data.mjs
node $DIRNAME/load-all-stops-routes.mjs
node $DIRNAME/load-all-trips.mjs
node $DIRNAME/load-headsigns.mjs
node $DIRNAME/load-op-timetable.mjs