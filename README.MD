# [TransportVic2](https://vic.transportsg.me)
Hi! This is a complete rewrite of TransportVic, now that I've lived in Melbourne for a longer time and actually know the system through.

## TODO:
- Fix day of week getter:
  - Use victorianholidays.ics file, on each holiday look at stony point timetable and count services on that day STY - FKN
    - Weekday 10, Friday 12
    - Saturday 8
    - Sunday 7

## Current mapping projects:
- Smartrak ID mapping
  - Enables the user to see at a glance what the bus rego of their bus will be, allowing for easier identification
- Bus bay GTFS ID mapping
  - Tells the user which bus bay the bus departs from, guiding them in interchanges
- Bus desto mapping

## New GTFS Loader:
- Ferry:
  - Unused GTFS ID 9
  - Reads timetable from https://www.ptv.vic.gov.au/more/travelling-on-the-network/ferries/
- Bus:
  - Loads standard GTFS components
  - Loads 788 stop numbers
  - Loads clockwise/anticlockwise loop directions
  - Includes operators and myki zones
  - Has all modes: metro bus, regional bus, telebus, nightbus, skybus
- Metro trains:
  - Loads standard GTFS components
  - Loads static WTT dump from metro website
  - Regional Coach:
    - Loads standard GTFS components
  - Trams
    - Loads standard GTFS components
    - Loads TramTracker IDs on a stop-level
  - V/Line Trains:
    - Loads standard GTFS components
    - Loads NSP static timetable dump

## Current features:
- Loading in MTM timetables
- Loading in bus timetables
- Loading in V/Line train timetables
- Loading in Regional coach timetables
- Loading in tram timetables, batching in place too
- Showing live MTM departures when the services are running as timetabled
- Predicting MTM City Loop configuration when services are running as timetabled
- Show proper destination names for MTM departures that match station announcements
  - RMD/NME/JLI -> FSS -> LOOP show up as Flinders Street services, though the loop config below makes it clear it still pass through the loop on the next trip
  - RMD/NME/JLI -> LOOP -> FSS show as City Loop
- Showing live V/Line departures when the services are running as timetabled
- Showing live V/Line departures when the services are NOT running as timetabled in GTFS, but falling back to NSP Run IDs.
- Showing live V/Line departures when there's completely no timetable match, this queries the trip stops and loads it in.
- Has the ability for live V/Line cancellations/alterations - this sets up an email server to get emails from V/Line Inform
- Showing live MTM departures when there's completely no timetable match (17:02 FSS ex Westall), also queries trip stops and loads it in.
- Looks for trips being formed next in City Loop stations, and joins it the the departure stops-at
- Showing Regional coach timetables.
  - Searches up regional coach timetables for match
  - If no match - try searching corresponding V/Line train timetables - if still no match discard it
    - Some train replacement trips are only programmed on PTV's end
  - This is due to PTV returning a new departure for every combined route sector
  - Looks up matching departure timings in NSP - if there's a match its a coach replacement service
- Offline mode
- Couple of mockup displays
  - Bus interchange LCD PIDS displays
  - Flinders Street Station escalator displays
  - Flinders Street Station platform displays
  - 32:9 LCD PIDS displays found at suburban stations
    - List format
    - Text format
  - Southern Cross platform displays
  - LED PIDS display found at suburban stations like Pakenham, Lilydale and Croydon

- GeoJSON visualiser, cos why not
- Checks disruptions whenever requesting for metro train departures - looks for suspended regions and adds a message / marks `isTrainReplacement` (need to rename to `isBusReplacement`)
- Stop merging in place
  - Roads do not get merged, see commit [0c3cf46](https://github.com/TransportVic/TransportVic2/commit/0c3cf45222eb2d94bc1e26cc6a95b862218a441f)
  - Looks for stops with the same primary stop name: Primary Stop Name/Road Name (Suburb)
  - If the primary stop name matches and the 2 stops are within a set distance, varying for stop types, they are merged.
  - When requesting stop timing data, the "bays" are filtered by mode, then grouped by originalName
    - If online, the first stopGTFSID is taken from each group, and sent to PTV's server
    - Otherwise, eash stopGTFSID is used and a getScheduledDepartures is called, with the results merged.
- Shows trip timings for MTM
  - Includes timetabled train model & relevant icon
  - Show run ID too
    - Specially cross references static TT dump for stony point line.
  - Takes the first trip past flinders street for down trips - allows it to be clear of the loop forming nonsense and also be able to tell apart the 17:27 crazyburn service
- Shows trip timings for V/Line
  - Includes timetabled train model & relevant icon & run ID
  - No realtime info
- Homepage done up together with webapp
  - Icon homepage remains, though it launches to `/nearby` if opened as a webapp
- Bus timings
  - Same implementation as coach except that it has a service number & realtime data.
  - Also looks up Smartrak ID for fleet numbers
  - Supports all types: metro, regional, skybus, telebus, nightbus
  - Does stop merging as well, only checks nightbus from 11pm - 8am on weekends
- Tram timings
  - Same implementation as buses, with merging as well
  - Has support for TramTrackerIDs printed on stops

## Next up to be added:
- fix the 3am PT day stuff, except that is actually 8am for nightbus timetables
  - includes normalising timings to what a decent human being would use - 31:35 is unacceptable for most people
- refactor out on-time stuff
- route view
- timetable view page
- timetable query page
  - enter departure time, service, origin, destination
  - attempts to find best match
  - enter run id (metro is +948000, 988000 for alphabetical prefixed runs)
- Icons for the various stopping pattern pages
  - Completed:
    - EDI Comeng (PTV) (Used for both types)
    - X'Traps (PTV)
    - Siemens (PTV)
    - N Locomotive (Mark 3)
    - Sprinter (Mark 3)
    - Velocity (PTV)
    - Volgren CR228L (PTV/White)
    - Volgren Optimus (PTV/White)
    - HCMT (PTV)
    - Optare Solo (PTV/White)
  - To Do:
    - Coach, need to find a suitable one for drawing
    - Trams (possibly do sideways rather than front?)
      - A1/2
      - B2 (looks the same as A1/2, which is why side)
      - C1
      - C2
      - D1
      - D2
      - E1/2
      - W8
      - Z3
  - Thoughts:
    - Trams will use a simple lookup from the tram number to get the model
    - Buses use smartrak ids
- Refactor all moment.tz to a utils method
- And everything else on TransportVic homepage (which i think there's nothing else)
- Fare calculator thingy (now a ptv api thing)
- Interstate
  - overland apparently
  - check how its actually programmed in, AM8 trips don't seem to be in?
- If disruption thing isn't implemented do a status board
- Maps (openstreetmap looks good)
- Weather if I can find a way to do it freely
  - bom: use ftp://ftp.bom.gov.au/anon/gen/fwo/IDV10753.xml
  - get nearest weather station, I HAD A LIST SOMEWHERE WITH COORDINATES TO SOMETHING LIKE 5DP |:<
  - ftp://ftp.bom.gov.au/anon/home/adfd/spatial
  - from nearest weather station use that list to check
- day mode
- SCS arrivals
- Timetable search
- myki manager if it's safe
  - store login info on client side?

## Setting up
* Standard `npm i -d`
* Create a config.json looking like
```
{
  "useHTTPS": false, // tells the server if you want to use the HTTPS server (runs on port 443)
  "sslCertPath": "", // where to find the SSL certs for HTTPS. Ignored if useHTTPS is false
  "httpPort": 8000, // The port to run the HTTP server on. Acts only as a redirect server if userHTTPS is true
  "databaseURL": "mongodb://localhost:27017", // MongoDB database URL. This should work fine
  "databaseName": "TransportVic", // MongoDB database name
  "webrootPath": "", // Location of the let's encrypt webroot
  "useLetsEncrypt": false, // Whether to use let's encrypt to automatically renew certs
  "certbotFlags": "", // Any extra flags to pass to the certbot renew call. For example using dns challenge

  "ptvKey": "", // Your PTV dev key.
  "ptvDevID": "", // Your PTV dev id. If left blank PTV api calls will not work and will fallback to gtfs timetable. This makes data less accurate

  "devMode": true // Enables/Disables compression of data and other stuff
}
```
with the appropriate fields filled
Create a modules.json with this filled
```
{
  "Next4": {
    "bus": true,
    "tram": true,
    "metro": true,
    "vline": true,
    "coach": true,
    "ferry": true
  },
  "tracker": {
    "bus": true,
    "vline": true
  },
  "mockups": {
    "pidsview": true
  },
  "routes": {
    "bus": true
  },
  "stopPreview": true,
  "jmssScreen": true,
  "vlineMail": true
}
```
And enable the modules you want. The example here has everything enabled. Keep in mind that GTFS loading is controlled by the Next4 entry, and that other modules such as trackers or routes do not check that the relevant module is enabled as well.

* You'll have to download additional data from Spatial Datamart Victoria and save it to `/spatial-datamart`
  * These typically come as a Esri shapefile, I used `shp2json` to generate geojson
  * metro-bus-route
  * metro-bus-stops
  * metro-train-stations
  * metro-tram-stops
  * night-bus-route
  * night-bus-stops
  * regional-bus-route
  * regional-bus-stops
  * regional-coach-routes
  * regional-coach-stops
  * skybus-route
  * skybus-stops
  * train-stations
  * vline-train-stations
* Run `modules/optimise-svg.js` to run through all the raw svg files and remove unneeded fields from them
* Run `update-gtfs.sh` to pull the latest GTFS data from PTV
* Run `node load-gtfs/metro-trains/extra/download-metro-timetables.js` and the v/line counterpart (do this just once unless the NSP/WTTs get updated)
* Create a blank `load-gtfs/stats.json`. (I'll make this automatic)
* Run `load-gtfs/load-all.sh` to load it all into the database (takes around 20min)
* You'll need to populate `urls.json` with magic values (sorry I can't help you with that unless maybe I know you or something. but eh it mostly runs fine without that file and can fallback to offline mode without it)
* You should be good to go!
