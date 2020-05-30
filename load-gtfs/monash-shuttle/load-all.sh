DIRNAME=$(dirname "$0")

node $DIRNAME/load-stops.js
node $DIRNAME/load-routes.js
node $DIRNAME/load-timetables.js
