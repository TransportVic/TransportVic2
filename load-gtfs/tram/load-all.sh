node --max-old-space-size=2048 load-gtfs/tram/load-tram-stops.js
node --max-old-space-size=2048 load-gtfs/tram/load-tram-routes.js
node --max-old-space-size=4096 --expose-gc --harmony load-gtfs/tram/gtfs-loader-wrapper.js
node --max-old-space-size=2048 load-gtfs/tram/tramtracker-id/load-tramtracker-ids.js
