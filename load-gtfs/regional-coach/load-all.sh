DIRNAME=$(dirname "$0")

node --max-old-space-size=2048 $DIRNAME/../divide-and-conquer/divide-and-conquer.js 5
node $DIRNAME/load-stops.js
node $DIRNAME/load-routes.js
node $DIRNAME/load-gtfs-timetables.js
node $DIRNAME/extra/load-connections.js
node $DIRNAME/extra/find-sss-sun-connections.js

node $DIRNAME/../vline-trains/extra/load-vline-timetables.js

node $DIRNAME/generate-route-pathing.js

rm -r $DIRNAME/../spliced-gtfs-stuff/5
