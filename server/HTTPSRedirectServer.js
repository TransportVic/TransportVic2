const url = require('url')
const path = require('path')
const fs = require('fs')
const config = require('../config.json')

module.exports = class HTTPSRedirectServer {
  app (req, res) {
    let reqURL = new url.URL('https://transportsg.me' + req.url)
    if (req.url.startsWith('/.well-known')) {
      const filePath = path.join(config.webrootPath, reqURL.pathname)

      fs.createReadStream(filePath).pipe(res)

      return
    }

    const redirectedURL = req.url.replace('http://', 'https://')

    res.writeHead(308, { Location: redirectedURL })
    res.end()
  }
}
