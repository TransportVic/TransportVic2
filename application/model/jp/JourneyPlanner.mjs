import path from 'path'
import utils from '../../../utils.mjs'
import fs from 'fs/promises'

const query = (await fs.readFile(path.join(import.meta.dirname, 'jp.graphql'))).toString()

export default class JourneyPlanner {

  #database

  constructor(database) {
    this.#database = database
  }

  getVariables() { return {} }

  async parseResponse(res) {
    return res
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
            // place: `1:${originBay.stopGTFSID}`,
            coordinates: {
              latitude: originBay.location.coordinates[1],
              longitude: originBay.location.coordinates[0],
            }
          },
          to: {
            // place: `1:${destinationBay.stopGTFSID}`
            coordinates: {
              latitude: destinationBay.location.coordinates[1],
              longitude: destinationBay.location.coordinates[0],
            }
          },
          dateTime: dateTime.toISOString(),
          arriveBy,
          searchWindow: 120
        }
      })
    }))

    return await this.parseResponse(response)
  }

}