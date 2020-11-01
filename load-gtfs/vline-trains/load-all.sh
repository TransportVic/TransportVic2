#!/bin/bash
DIRNAME=$(dirname "$0")

node --max-old-space-size=2048 $DIRNAME/../divide-and-conquer/divide-and-conquer.js" 1
node "$DIRNAME/load-stops.js"
node "$DIRNAME/load-routes.js"
node "$DIRNAME/load-gtfs-timetables.js"
node "$DIRNAME/extra/load-vline-timetables.js"
node "$DIRNAME/extra/load-vline-zones.js"
node "$DIRNAME/api-integration/load-vnet-station-names.js"

rm -r "$DIRNAME/../spliced-gtfs-stuff/1"
