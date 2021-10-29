const url = require('url')
const path = require('path')
const fs = require('fs')
const config = require('../config.json')

module.exports = class HTTPSRedirectServer {
  app (req, res) {
    let urlMatch
    if (urlMatch = req.url.match(/\/.well-known\/acme-challenge\/(\w*)/)) {
      let filePath = path.join(config.webrootPath, urlMatch[0])

      let stream = fs.createReadStream(filePath)
      stream.pipe(res)

      stream.on('error', err => {
        res.writeHead(404).end('404')
      })

      return
    }

    const redirectedURL = 'https://' + req.headers.host + req.url

    res.writeHead(308, { Location: redirectedURL })
    res.end()
  }
}
