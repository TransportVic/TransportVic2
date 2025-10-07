#!/bin/bash
DIRNAME=$(dirname "$0")

. $DIRNAME/../../.env

node $DIRNAME/vline/southern-cross-platform.mjs
node $DIRNAME/vline/vline-gtfsr-trips.mjs
node $DIRNAME/vline/vline-gtfsr-fleet.mjs