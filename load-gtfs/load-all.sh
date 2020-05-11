DIRNAME=$(dirname "$0")

node $DIRNAME/create-indexes.js

$DIRNAME/metro-trains/load-all.sh
$DIRNAME/vline-trains/load-all.sh
$DIRNAME/regional-coach/load-all.sh
$DIRNAME/bus/load-all.sh
$DIRNAME/trams/load-all.sh

node $DIRNAME/load-route-stops.js
node $DIRNAME/load-stop-services.js

node $DIRNAME/../lgas/load-lgas.js
node $DIRNAME/../lgas/load-route-lgas.js
