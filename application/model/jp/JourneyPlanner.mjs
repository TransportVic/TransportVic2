import path from 'path'
import utils from '../../../utils.mjs'
import fs from 'fs/promises'
import async from 'async'
import mock from './mock.mjs'
import moment from 'moment'

const query = (await fs.readFile(path.join(import.meta.dirname, 'jp.graphql'))).toString()

export default class JourneyPlanner {

  #database

  constructor(database) {
    this.#database = database
  }

  getVariables() { return {} }

  async parseResponse({ data, errors }) {
    if (!data && errors) return { error: 'PLANNER_ERROR', journeys: [] }
    const { trip } = data
    if (!trip.tripPatterns.length) return { error: 'NO_JOURNEYS', journeys: [] }

    const gtfsTimetables = this.#database.getCollection('gtfs timetables')
    const journeys = await async.map(trip.tripPatterns, async journey => {
      const legs = await async.map(journey.legs, async leg => {
        const tripID = leg.serviceJourney?.id.slice(4)
        const matchingTrip = tripID ? await gtfsTimetables.findDocument({ tripID }) : null

        return {
          mode: matchingTrip?.mode || leg.mode,
          routeName: matchingTrip?.routeName,
          routeNumber: matchingTrip?.routeNumber,
          legStartTime: utils.parseTime(leg.aimedStartTime),
          legEndTime: utils.parseTime(leg.aimedEndTime),
          duration: moment.duration(leg.duration * 1000),
          legOrigin: {
            name: leg.fromPlace.name
          },
          legDestination: {
            name: leg.toPlace.name
          },
          path: leg.pointsOnLink.points,
          steps: leg.steps
        }
      })

      return {
        startTime: utils.parseTime(journey.aimedStartTime),
        endTime: utils.parseTime(journey.aimedEndTime),
        duration: moment.duration(journey.duration * 1000),
        legs
      }
    })

    return {
      previousPage: trip.previousPageCursor,
      nextPage: trip.nextPageCursor,
      journeys
    }
  }

  async getBay(stop) {
    const stops = this.#database.getCollection('stops')
    const { mode, id } = stop

    const stopData = await stops.findDocument({
      _id: stops.createObjectID(id)
    })

    if (!stopData) return null

    const bay = stopData.bays.find(bay => bay.mode === mode)
    return bay
  }

  async plan(originStop, destinationStop, dateTime, arriveBy) {
    const originBay = await this.getBay(originStop)
    const destinationBay = await this.getBay(destinationStop)

    if (!originBay || !destinationBay) return null

    // const response = mock
    const response = JSON.parse(await utils.request('https://jp.transportvic.me/otp/transmodel/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operationName: 'trip',
        query,
        variables: {
          from: {
            place: `ptv:${originBay.stopGTFSID}`
          },
          to: {
            place: `ptv:${destinationBay.stopGTFSID}`
          },
          dateTime: dateTime.toISOString(),
          arriveBy,
          searchWindow: 120
        }
      }),
      timeout: 12000
    }))

    return await this.parseResponse(response)
  }

}