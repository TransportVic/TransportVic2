module.exports = async function mergeConsist(trip, newConsist, metroTrips) {
  let query = {
    date: trip.operationDays,
    runID: trip.runID.slice(0, 4)
  }

  let tripData = {
    ...query,
    origin: trip.trueOrigin.slice(0, -16),
    destination: trip.trueDestination.slice(0, -16),
    departureTime: trip.trueDepartureTime,
    destinationArrivalTime: trip.trueDestinationArrivalTime,
    consist: newConsist
  }

  let existingTrip = await metroTrips.findDocument(query)
  if (existingTrip && existingTrip.forced) {
    tripData = {
      ...tripData,
      forced: true,
      consist: existingTrip.consist,
      icon: existingTrip.icon,
      size: existingTrip.size
    }
  } else if (existingTrip && tripData.consist.length === 3) {
    if (existingTrip.consist.length === 6) { // Trip already exists with a filled consist, we only override if a different set matches
      if (!existingTrip.consist.includes(tripData.consist[0])) {
      } else {
        // Otherwise do not override a 6 car train with a 3 car
        // However update the departure fleet for location purposes

        tripData.consist = existingTrip.consist
      }
    } else if (existingTrip.consist.length === 3 && !existingTrip.consist.includes(tripData.consist[0])) { // We might have matched half a train and now have the other half, sanity check
      let sanityCheckTrip = await metroTrips.findDocument({
        date: departure.departureDay,
        $and: [{ // Match both the one already existing and the one given on the same day to check if they're coupled up and can be merged
          consist: tripData.consist[0]
        }, {
          consist: existingTrip.consist[0]
        }]
      })

      if (sanityCheckTrip) {
        tripData.consist = sanityCheckTrip.consist
      }

      // if they can be merged update
      // if cannot be merged assume that another set is taking over and update
    } else { // Some other length? (HCMT or random crap, override it)
    }
  }

  await metroTrips.replaceDocument(query, tripData, {
    upsert: true
  })

  return tripData.consist
}
