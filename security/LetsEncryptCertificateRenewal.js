const childProcess = require('child_process')
const HTTPSServer = require('../server/HTTPSServer')

const config = require('../config.json')

function renew() {
    console.log(new Date(), 'renewing certs')
    childProcess.exec('certbot renew --non-interactive -a manual --preferred-challenges dns --manual-auth-hook "/home/ec2-user/certbot-hook.sh auth" --manual-cleanup-hook "/home/ec2-user/certbot-hook.sh cleanup"', function(err, stdout, stderr) {
        stdout = stdout.toString().trim()
        stderr = stderr.toString().trim()
        if (stdout) console.log(stdout)
        if (stderr) console.error(stderr)
        HTTPSServer.createSecureContext(config.sslCertPath)
    })
}

setInterval(renew, 1000 * 60 * 60 * 12)
renew()
