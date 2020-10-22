DIRNAME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

node $DIRNAME/download-gtfs.js
cd $DIRNAME/../../gtfs/14
rm *.txt
unzip google_transit.zip

cd ../../
node $DIRNAME/load-stops.js
node $DIRNAME/load-routes.js
node $DIRNAME/load-gtfs-timetables.js
