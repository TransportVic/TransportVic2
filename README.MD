# TransportVic2
Hi! This is a complete rewrite of TransportVic, now that I've lived in Melbourne for a longer time and actually know the system through.

## Current features:
- Loading in MTM timetables
- Loading in V/Line train timetables
- Showing live MTM departures when the services are running as timetabled
- Predicting MTM City Loop configuration when services are running as timetabled
- Show proper destination names for MTM departures that match station announcements
  - RMD/NME/JLI -> FSS -> LOOP show up as Flinders Street services, though the loop config below makes it clear it still pass through the loop on the next trip
  - RMD/NME/JLI -> LOOP -> FSS show as City Loop
- Showing live V/Line departures when the services are running as timetabled
- Showing live V/Line departures when the services are NOT running as timetabled in GTFS, but falling back to NSP Run IDs. Currently no support for updated stopping patterns or stop times
- Showing live V/Line departures when there's completely no timetable match, this plasters warnings all over the departure row
- Showing live MTM departures when there's completely no timetable match (17:02 FSS ex Westall), also plasters warnings on the departure.
- Looks for trips being formed next in City Loop stations, and joins it the the departure stops-at
- Offline mode
- Couple of mockup displays
  - Flinders Street Station escalator displays
  - 7x2 LCD PIDS displays found at suburban stations
- GeoJSON visualiser, cos why not
- Checks disruptions every 10min, currently handles suspensions
  - Finds trips affected by suspension and breaks into 3 - first train leg, bus leg and second train leg.
  - Currently only looks at end stations, should have it check all stations in between for those express services?
- Ability to detect when V/Line trains are scheduled to run as coaches. Currently no support for live disruptions.

## Next up to be added:
- refactor getting timetables in modules/./get_departures
- Added support for MTM "ghost trips", but since there's very few just do a /pattern and load into live DB
- Reading English and creating a daily timetable update DB collection, can be used to mark services as coaches / cancelled (V/Line!!) as well as just MTM train types
  - could work with Yarra Trams too, mark tram number
  - but i guess i need to teach it tram models then
- Showing stopping patterns for MTM and V/Line services
  - Show timings and stops most importantly
  - Show Run ID and vehicle type + icon (yay!)
- Marking the current completely unknown trips in the live DB, and using more magic to get the stopping patterns for those
- Load in regional coach services (but only for replacement runs first? idk tbh see how the implementation goes)
- Homepage
- Work out how to index the timetables better
- Also find out how to ID replacement services
- Make sure when it says 5:27pm Craigieburn it picks the correct one (maybe using loop heuristics)
- Load in metropolitan bus timetables
- And of course the departure info
  - Look into merging bus stops (Eg. Clayton Railway Station can show both Clayton Road and Carnish Road timings)
  - Merge night bus timings too? Though only merge if its at night LOL
  - Ohno just realised Monash University and Monash University/Wellington Road are different :/
    - maybe add sub headings to clearly id which stop the timings belong to, though this may be confusing
- Then show bus stopping patterns
- And of course trams
- Tram Tracker stop IDs
- Bookmarks
- App mode
- And everything else on TransportVic homepage (which is think there's nothing else)
- Replace TransportVic
- Fare calculator thingy
- Full regional coach support if not yet done
- Regional bus
  - Then show the town too, using suburb -> council/LGA list
  - Eg XXX: Regional Bus Stop in Suburb (Greater Geelong)
- Telebus
  - idk if the damn stop info is still messed up
- Night bus
  - Sorta goes under metropolitan bus but not quite
- Interstate bus
  - wtf is this even
  - do it anyway
- SkyBus
  - ah yes overpriced
- Ferries
- Tourist trains
  - MAKE SURE PUFFING BILLY IS SHOWN LAST
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

## Me talking about how it works
Realtime V/Line departures?

-> Does their app do it? Yes, but actually no
