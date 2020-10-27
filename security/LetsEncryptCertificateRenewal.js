const childProcess = require('child_process')
const HTTPSServer = require('../server/HTTPSServer')

const config = require('../config.json')

function renew() {
  global.loggers.general.info('Renewing Certs')
  childProcess.exec(`certbot renew ${config.certbotFlags}`, function(err, stdout, stderr) {
    stdout = stdout.toString().trim()
    stderr = stderr.toString().trim()
    if (stdout) stdout.split('\n').forEach(x => global.loggers.certs.log(x))
    if (stderr) stderr.split('\n').forEach(x => global.loggers.certs.err(x))

    config.sslCerts.forEach(cert => {
      HTTPSServer.createSecureContext(cert)
    })
  })
}

if (config.useLetsEncrypt) {
  setInterval(renew, 1000 * 60 * 60 * 12)
  renew()
}
