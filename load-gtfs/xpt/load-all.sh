DIRNAME=$(dirname "$0")

node $DIRNAME/download-gtfs.js
cd $DIRNAME/../../gtfs/14
rm *.txt
unzip google_transit.zip

node $DIRNAME/load-stops.js
node $DIRNAME/load-routes.js
node $DIRNAME/load-gtfs-timetables.js
