const url = require('url')
const path = require('path')
const fs = require('fs')
const config = require('../config.json')

module.exports = class HTTPSRedirectServer {
  app (req, res) {
    let reqURL = new url.URL('https://transportsg.me' + req.url)
    if (req.url.startsWith('/.well-known')) {
      const filePath = path.join(config.webrootPath, reqURL.pathname.split('/')[2])

      fs.createReadStream(filePath).pipe(res)

      return
    }

    const redirectedURL = `https://${config.websiteDNSName}${reqURL.pathname}`

    res.writeHead(308, { Location: redirectedURL })
    res.end()
  }
}
