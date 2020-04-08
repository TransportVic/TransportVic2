DIRNAME=$(dirname "$0")

node $DIRNAME/create-indexes.js

$DIRNAME/metro-trains/load-all.sh
$DIRNAME/vline-trains/load-all.sh
$DIRNAME/regional-coach/load-all.sh
$DIRNAME/bus/load-all.sh
$DIRNAME/trams/load-all.sh
