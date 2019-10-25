node --max-old-space-size=2048 load-gtfs/metro-bus/load-bus-stops.js 7
node --max-old-space-size=2048 load-gtfs/metro-bus/load-bus-routes.js 7
node --max-old-space-size=4096 --expose-gc --harmony load-gtfs/metro-bus/gtfs-loader-wrapper.js 7 true
