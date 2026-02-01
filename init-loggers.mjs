import { FileLogger, ConsoleLogger } from '@transportme/logger'
import path from 'path'
import url from 'url'
import utils from './utils.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (!process.env.NODE_ENV) await utils.setEnv()
let isProd = process.env['NODE_ENV'] === 'prod'

export function getLogPath(logPath) {
  return path.join(__dirname, 'logs', utils.getYYYYMMDDNow(), logPath)
}

export default async function createLogger(logPath, name) {
  let fullPath = getLogPath(logPath)

  if (isProd) {
    let logger = new FileLogger(fullPath, name)
    await logger.init()
    return logger
  }
  else return new ConsoleLogger(name)
}

async function createLoggers() {
  global.loggers = {
    http: await createLogger('http', 'HTTP'),
    mail: await createLogger('mail', 'MAIL'),
    spamMail: await createLogger('spam-mail', 'SPAM-MAIL'),
    fetch: await createLogger('fetch', 'FETCH'),
    trackers: {
      generic: await createLogger('trackers/generic', 'GENERIC'),
      metro: await createLogger('trackers/metro', 'METRO'),
      bus: await createLogger('trackers/bus', 'BUS'),
      metroRRB: await createLogger('trackers/metro-rail-bus', 'METRO-RRB'),
      vline: await createLogger('trackers/vline', 'VLINE'),
    },
    oldTrackers: {
      bus: await createLogger('old-trackers/bus', 'OLD-BUS'),
      tram: await createLogger('old-trackers/tram', 'OLD-TRAM'),
      vline: await createLogger('old-trackers/vline', 'OLD-VLINE'),
      vlineR: await createLogger('old-trackers/vline-realtime', 'OLD-VLINE-R'),
      metro: await createLogger('old-trackers/metro', 'OLD-METRO'),
      metroNotify: await createLogger('old-trackers/metro', 'OLD-METRO-NOTIFY'),
      xpt: await createLogger('old-trackers/xpt', 'OLD-XPT'),
      ccl: await createLogger('old-trackers/ccl', 'OLD-CCL')
    },
    mockups: await createLogger('mockups', 'MOCKUPS'),
    error: await createLogger('errors', 'ERROR'),
    general: await createLogger('general', 'GENERAL')
  }
}

await createLoggers()

let midnight = utils.now().endOf('day')
let msToMidnight = midnight.diff(utils.now())
setTimeout(() => {
  createLoggers()
  setInterval(createLogger, 1000 * 60 * 60 * 24).unref()
}, msToMidnight).unref()