const Logger = require('./Logger')
const path = require('path')

global.loggers = {
  http: new Logger(path.join(__dirname, 'logs', 'http'), 'HTTP'),
  mail: new Logger(path.join(__dirname, 'logs', 'mail'), 'MAIL'),
  spamMail: new Logger(path.join(__dirname, 'logs', 'spam-mail'), 'SPAM-MAIL'),
  fetch: new Logger(path.join(__dirname, 'logs', 'fetch'), 'FETCH'),
  trackers: {
    bus: new Logger(path.join(__dirname, 'logs', 'trackers', 'bus'), 'BUS'),
    tram: new Logger(path.join(__dirname, 'logs', 'trackers', 'tram'), 'TRAM'),
    vline: new Logger(path.join(__dirname, 'logs', 'trackers', 'vline'), 'VLINE'),
    vlineR: new Logger(path.join(__dirname, 'logs', 'trackers', 'vline-realtime'), 'VLINE-R'),
    metro: new Logger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO'),
    metroNotify: new Logger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO-NOTIFY'),
    xpt: new Logger(path.join(__dirname, 'logs', 'trackers', 'xpt'), 'XPT'),
    ccl: new Logger(path.join(__dirname, 'logs', 'trackers', 'ccl'), 'CCL')
  },
  mockups: new Logger(path.join(__dirname, 'logs', 'mockups'), 'MOCKUPS'),
  error: new Logger(path.join(__dirname, 'logs', 'errors'), 'ERROR'),
  general: new Logger(path.join(__dirname, 'logs', 'general'), 'GENERAL'),
  certs: new Logger(path.join(__dirname, 'logs', 'certs'), 'CERTS')
}
