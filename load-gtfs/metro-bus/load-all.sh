node --max-old-space-size=2048 load-gtfs/metro-bus/load-bus-stops.js 4
node --max-old-space-size=2048 load-gtfs/metro-bus/load-bus-routes.js 4
node --max-old-space-size=4096 --expose-gc --harmony load-gtfs/metro-bus/gtfs-loader-wrapper.js 4
