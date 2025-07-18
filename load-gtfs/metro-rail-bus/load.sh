#!/bin/bash
DIRNAME=$(dirname "$0")
. $HOME/.bash_profile

cd $DIRNAME

node download-data.mjs
EC1=$?
node load-all-stops-routes.mjs
EC2=$?
node load-all-trips.mjs
EC3=$?
node load-headsigns.mjs
EC4=$?
node load-op-timetable.mjs
EC5=$?

if [[ $EC1 -ne 0 ]] || [[ $EC2 -ne 0 ]] || [[ $EC3 -ne 0 ]] || [[ $EC4 -ne 0 ]] || [[ $EC5 -ne 0 ]]; then
  echo "At least 1 script failed"
  node -e "require('../../modules/discord-integration.js')('gtfsHealthCheck', 'MTM Rail: Load Failed!')"
fi