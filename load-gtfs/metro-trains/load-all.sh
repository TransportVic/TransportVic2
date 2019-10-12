node load-gtfs/metro-trains/load-metro-rail-stations.js
node load-gtfs/metro-trains/load-metro-rail-routes.js
node --max-old-space-size=2048 load-gtfs/metro-trains/load-metro-gtfs-timetables.js
node load-gtfs/metro-trains/load-metro-route-stops.js
node --max-old-space-size=2048 load-gtfs/metro-trains/load-metro-static-timetables.js
