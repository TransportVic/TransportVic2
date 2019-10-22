node --max-old-space-size=2048 load-gtfs/metro-bus/load-metro-bus-stops.js
node --max-old-space-size=2048 load-gtfs/metro-bus/load-metro-bus-routes.js
node --max-old-space-size=4096 --expose-gc --harmony load-gtfs/metro-bus/gtfs-loader-wrapper.js
