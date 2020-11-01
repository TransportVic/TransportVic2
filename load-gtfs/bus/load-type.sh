#!/bin/bash
DIRNAME=$(dirname "$0")

node --max-old-space-size=2048 "$DIRNAME/../divide-and-conquer/divide-and-conquer.js" $1
node "$DIRNAME/load-stops.js" $1
node "$DIRNAME/load-routes.js" $1
node "$DIRNAME/load-gtfs-timetables.js" $1

rm -r "$DIRNAME/../spliced-gtfs-stuff/$1"
