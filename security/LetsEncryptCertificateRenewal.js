const childProcess = require('child_process')
const HTTPSServer = require('../server/HTTPSServer')

const config = require('../config.json')

function renew() {
  global.loggers.general.info('Renewing Certs')
  childProcess.exec(`certbot renew ${config.certbotFlags}`, function(err, stdout, stderr) {
    stdout = stdout.toString().trim()
    stderr = stderr.toString().trim()
    if (stdout) stdout.split('\n').forEach(global.loggers.certs.log)
    if (stderr) stderr.split('\n').forEach(global.loggers.certs.err)

    config.sslCerts.forEach(cert => {
      HTTPSServer.createSecureContext(cert)
    })
  })
}

setInterval(renew, 1000 * 60 * 60 * 12)
renew()
