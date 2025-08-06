#!/bin/bash
DIRNAME=$(dirname "$0")

node $DIRNAME/vline/southern-cross-platform.mjs
node $DIRNAME/vline/vline-gtfsr-trips.mjs