const childProcess = require('child_process')
const HTTPSServer = require('../server/HTTPSServer')

const config = require('../config.json')

function renew() {
  console.log('renewing certs')
  childProcess.exec(`certbot renew ${config.certbotFlags}`, function(err, stdout, stderr) {
    stdout = stdout.toString().trim()
    stderr = stderr.toString().trim()
    if (stdout) console.log(stdout)
    if (stderr) console.error(stderr)

    config.sslCerts.forEach(cert => {
      module.exports.createSecureContext(cert)
    })
  })
}

setInterval(renew, 1000 * 60 * 60 * 12)
renew()
