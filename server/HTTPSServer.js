const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

let secureContext = null;

module.exports = {

    createSecureContext: certPath => {
        let sslCertPath = path.join(certPath, 'fullchain.pem'),
            sslKeyPath = path.join(certPath, 'privkey.pem'),
            caPath = path.join(certPath, 'chain.pem');

        let context = tls.createSecureContext({
            cert: fs.readFileSync(sslCertPath),
            key: fs.readFileSync(sslKeyPath),
            ca: fs.readFileSync(caPath),
            minVersion: 'TLSv1.2'
        });

        secureContext = context;
    },

    getSecureContext: () => {
        return secureContext
    },

    createSNICallback: () => {
        return (servername, callback) => {
            callback(null, module.exports.getSecureContext());
        };
    },

    createServer: (app, certPath) => {
        module.exports.createSecureContext(certPath);

        return https.createServer({
            SNICallback: module.exports.createSNICallback()
        }, app.app);
    }

};

if (config.useLetsEncrypt)
    require('../security/LetsEncryptCertificateRenewal');
