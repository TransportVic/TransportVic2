import { FileLogger, ConsoleLogger } from '@transportme/logger'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let isProd = process.env['NODE_ENV'] === 'prod'
async function createLogger(path, name) {
  if (isProd) {
    let logger = new FileLogger(path, name)
    await logger.init()
    return logger
  }
  else return new ConsoleLogger(name)
}

export default global.loggers = {
  http: await createLogger(path.join(__dirname, 'logs', 'http'), 'HTTP'),
  mail: await createLogger(path.join(__dirname, 'logs', 'mail'), 'MAIL'),
  spamMail: await createLogger(path.join(__dirname, 'logs', 'spam-mail'), 'SPAM-MAIL'),
  fetch: await createLogger(path.join(__dirname, 'logs', 'fetch'), 'FETCH'),
  trackers: {
    bus: await createLogger(path.join(__dirname, 'logs', 'trackers', 'bus'), 'BUS'),
    tram: await createLogger(path.join(__dirname, 'logs', 'trackers', 'tram'), 'TRAM'),
    vline: await createLogger(path.join(__dirname, 'logs', 'trackers', 'vline'), 'VLINE'),
    vlineR: await createLogger(path.join(__dirname, 'logs', 'trackers', 'vline-realtime'), 'VLINE-R'),
    metro: await createLogger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO'),
    metroNotify: await createLogger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO-NOTIFY'),
    xpt: await createLogger(path.join(__dirname, 'logs', 'trackers', 'xpt'), 'XPT'),
    ccl: await createLogger(path.join(__dirname, 'logs', 'trackers', 'ccl'), 'CCL')
  },
  mockups: await createLogger(path.join(__dirname, 'logs', 'mockups'), 'MOCKUPS'),
  error: await createLogger(path.join(__dirname, 'logs', 'errors'), 'ERROR'),
  general: await createLogger(path.join(__dirname, 'logs', 'general'), 'GENERAL')
}
