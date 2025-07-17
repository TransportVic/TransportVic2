import { FileLogger, ConsoleLogger } from '@transportme/logger'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let isProd = process.env['NODE_ENV'] === 'prod'
function createLogger(path, name) {
  if (isProd) return new FileLogger(path, name)
  else return new ConsoleLogger(name)
}

global.loggers = {
  http: createLogger(path.join(__dirname, 'logs', 'http'), 'HTTP'),
  mail: createLogger(path.join(__dirname, 'logs', 'mail'), 'MAIL'),
  spamMail: createLogger(path.join(__dirname, 'logs', 'spam-mail'), 'SPAM-MAIL'),
  fetch: createLogger(path.join(__dirname, 'logs', 'fetch'), 'FETCH'),
  trackers: {
    bus: createLogger(path.join(__dirname, 'logs', 'trackers', 'bus'), 'BUS'),
    tram: createLogger(path.join(__dirname, 'logs', 'trackers', 'tram'), 'TRAM'),
    vline: createLogger(path.join(__dirname, 'logs', 'trackers', 'vline'), 'VLINE'),
    vlineR: createLogger(path.join(__dirname, 'logs', 'trackers', 'vline-realtime'), 'VLINE-R'),
    metro: createLogger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO'),
    metroNotify: createLogger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO-NOTIFY'),
    xpt: createLogger(path.join(__dirname, 'logs', 'trackers', 'xpt'), 'XPT'),
    ccl: createLogger(path.join(__dirname, 'logs', 'trackers', 'ccl'), 'CCL')
  },
  mockups: createLogger(path.join(__dirname, 'logs', 'mockups'), 'MOCKUPS'),
  error: createLogger(path.join(__dirname, 'logs', 'errors'), 'ERROR'),
  general: createLogger(path.join(__dirname, 'logs', 'general'), 'GENERAL')
}
