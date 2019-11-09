# [TransportVic2](https://vic.transportsg.me)
Hi! This is a complete rewrite of TransportVic, now that I've lived in Melbourne for a longer time and actually know the system through.

## Current mapping projects:
- Smartrak ID mapping
  - Enables the user to see at a glance what the bus rego of their bus will be, allowing for easier identification
- Bus bay GTFS ID mapping
  - Tells the user which bus bay the bus departs from, guiding them in interchanges
- Bus desto mapping

## Current features:
- Loading in MTM timetables
- Loading in bus timetables
  - Multiple batching rounds in place to optimise memory usage:
  - Repeated I/O preferred over massive 2GB memory usage, currently tops around 800MB
  - Takes 30min to load on the mini T3.micro server
- Loading in V/Line train timetables
- Loading in Regional coach timetables
- Loading in tram timetables, batching in place too
- Stats
  - High intensity bus ops GTFS dataset takes just under 50min to fully load
  - Loader stats stored in /load-gtfs/stats.json, need to add a visualiser for this
- Showing live MTM departures when the services are running as timetabled
- Predicting MTM City Loop configuration when services are running as timetabled
- Show proper destination names for MTM departures that match station announcements
  - RMD/NME/JLI -> FSS -> LOOP show up as Flinders Street services, though the loop config below makes it clear it still pass through the loop on the next trip
  - RMD/NME/JLI -> LOOP -> FSS show as City Loop
- Showing live V/Line departures when the services are running as timetabled
- Showing live V/Line departures when the services are NOT running as timetabled in GTFS, but falling back to NSP Run IDs.
- Showing live V/Line departures when there's completely no timetable match, this queries the trip stops and loads it in.
- Showing live MTM departures when there's completely no timetable match (17:02 FSS ex Westall), also queries trip stops and loads it in.
- Looks for trips being formed next in City Loop stations, and joins it the the departure stops-at
- Showing Regional coach timetables. Consults the PTV API as some replacement trips are randomly excluded from the GTFS dump
- Offline mode
- Couple of mockup displays
  - Flinders Street Station escalator displays
  - 7x2 LCD PIDS displays found at suburban stations
- GeoJSON visualiser, cos why not
- Checks disruptions every 10min, currently handles suspensions
  - Finds trips affected by suspension and breaks into 3 - first train leg, bus leg and second train leg.
  - Currently only looks at end stations, should have it check all stations in between for those express services?
- Ability to detect when V/Line trains are scheduled to run as coaches.
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
    - Specially cross references static TT dump for stony point line. Hardcoded as 2x SP for all services, need to camp out and find those operating as 1x SP
  - Takes the first trip past flinders for down trips - allows it to be clear of the loop forming nonsense and also be able to tell apart the 527 crazyburn service
- Shows trip timings for V/Line
  - Includes timetabled train model & relevant icon & run ID
  - No realtime info
- V/Line coach replacement override
  - Apparently PTV doesn't bother programming in some replacement operations into the regional coach thing so to the program it thinks nothing exists for those services
  - Not sure accurate but at least it alerts the user to the disruption in their face, PTV doesn't even outright tell you
  - Also calls up the PTV API cos they're lazy with releasing GTFS dumps meaning that some replacement ops get missed out :( (looking at you albury)
- Homepage done up together with webapp
  - Icon homepage remains, though it launches to `/nearby` if opened as a webapp
- Pings V/Line's disruption feed every 10-20 minutes as part of its health check, and attempts to mark the services as cancelled / replaced by coaches. Doesn't always work if the service is already disrupted but not programmed in by PTV
- Bus timings
  - Same implementation as coach except that it has a service number & realtime data.
  - Supports all types: metro, regional, skybus, telebus, nightbus
  - Does stop merging as well, only checks nightbus from 11pm - 8am
  - Attempts to show the bus fleet number for easier ID-ing
- Tram timings
  - Same implementation as buses, with merging as well
  - Has support for TramTrackerIDs printed on stops, using old merger algorithm to merge.
    - Matcher needs to be optimised, currently loads tonnes of matches for a stop

## Next up to be added:
- offline mode but client side
- fix up trip/departure merging for merged stops (beaconsfield RS)
- fix the 3am PT day stuff, except that is actually 8am for nightbus timetables
  - includes normalising timings to what a decent human being would use - 31:35 is unacceptable for most people
- refactor out on-time stuff
- route view
- timetable view page
- timetable query page
  - enter departure time, service, origin, destination
  - attempts to find best match
  - enter run id
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
  - To Do:
    - Optare Solo (PTV/White)
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
- Also find out how to ID replacement services
- Bookmarks
- About page, make it actually better
- And everything else on TransportVic homepage (which i think there's nothing else)
- Fare calculator thingy
- Interstate
  - overland apparently
- Ferries
- If disruption thing isn't implemented do a status board
- Auto update of GTFS data?
- Maps
- Weather if I can find a way to do it freely
- Maybe add a gunzel mode: show freight train timetables?? knockoff TRIMS
- At this point its better than PTV * big flex *
- day mode
- SCS arrivals
- Timetable search
- jeez this list is long
- journey planner if it takes the whole 2020 to impl this
- myki manager if it's safe
  - store login info on client side?

## Setting up
Create a config.json looking like
```
{
    "useHTTPS": false,
    "sslCertPath": "",
    "httpPort": 8000,
    "databaseURL": "mongodb://localhost:27017",
    "databaseName": "TransportVic",
    "websiteDNSName": "localhost",
    "webrootPath": "",
    "useLetsEncrypt": false,
    "busTrackerPath": "",

    "ptvKey": "",
    "ptvDevID": "",

    "gtfsBatcher": false
}
```
with the appropriate fields filled
