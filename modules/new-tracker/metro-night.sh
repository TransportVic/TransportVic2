#!/bin/bash
DIRNAME=$(dirname "$0")

. $DIRNAME/../../.env

# node $DIRNAME/metro/metro-gtfsr-trips.mjs
node $DIRNAME/metro/metro-gtfsr-fleet.mjs
node $DIRNAME/metro/metro-ptv-departures.mjs
node $DIRNAME/metro/metro-ptv-trips.mjs
node $DIRNAME/metro/metro-notify.mjs
node $DIRNAME/metro/metro-notify-trips.mjs
node $DIRNAME/metro/metro-cbd-ptv-departures.mjs
node $DIRNAME/metro/metro-notify-suspensions.mjs
node $DIRNAME/metro/metro-outdated-trips.mjs