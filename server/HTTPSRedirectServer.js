const url = require('url')
const path = require('path')
const fs = require('fs')
const config = require('../config.json')

module.exports = class HTTPSRedirectServer {
  app (req, res) {
    if (req.url.startsWith('/.well-known')) {
      req.url = url.URL(req.url)
      const filePath = path.join(config.webrootPath, req.url.path)

      fs.createReadStream(filePath).pipe(res)

      return
    }

    const redirectedURL = `https://${config.websiteDNSName}${url.parse(req.url).path}`

    res.writeHead(308, { Location: redirectedURL })
    res.end()
  }
}
