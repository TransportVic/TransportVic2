import { fileURLToPath } from 'url'
import config from '../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import fs from 'fs/promises'
import path from 'path'
import { getLogPath } from '../../init-loggers.mjs'

class VLineLoggingAPIInterface extends VLineAPIInterface {

  lastResponse = null

  async performFetch(apiMethod, requestOptions) {
    const response = await super.performFetch(apiMethod, requestOptions)
    this.lastResponse = response

    return response
  }

}

export default async function saveOperationalTT(ptvAPI, vlineAPIInterface) {
  await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 1440)

  const rawResponse = vlineAPIInterface.lastResponse

  const responsePath = getLogPath('vline-op-tt.xml')
  const folderName = path.dirname(responsePath)
  await fs.mkdir(folderName, { recursive: true })

  await fs.writeFile(responsePath, rawResponse)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  const vlineAPIInterface = new VLineLoggingAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  await saveOperationalTT(ptvAPI, vlineAPIInterface)
}
