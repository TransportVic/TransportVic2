#!/bin/bash

DIRNAME=$(dirname "$0")

"$DIRNAME/update-calendars.sh"
node "$DIRNAME/update-consists.js"
