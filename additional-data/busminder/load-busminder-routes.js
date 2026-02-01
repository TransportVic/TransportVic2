const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const async = require('async')
const config = require('../../config')
const urls = require('../../urls')
const utils = require('../../utils.mjs')

async function main() {
  let body = await utils.request(urls.venturaBusMinder, {
    headers: {
      'Host': 'maps.busminder.com.au',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0'
    },
    timeout: 15 * 1000
  })

  let $ = cheerio.load(body)
  let script = Array.from($('body > script')).slice(-2)[0].children[0].data.trim()

  let jsonContent = JSON.parse(script.slice(script.indexOf('{'), script.lastIndexOf('}') + 1))

  let routes = jsonContent.routes.map(route => {
    let routeNumber = null, routeDestination = null
    let routeName = route.name.replace(' Night', '').replace(' - ', ' to ').replace('|', '').replace(/ ?: /, ' ').replace(/V\/line/i, '').replace(/  +/g, ' ').trim()
    if (routeName.match(/^\d+S/)) return null

    if (routeName.includes('FlexiRide')) {
      routeNumber = 'FlexiRide'
      routeDestination = routeName.slice(10)
    } else {
      let parts = routeName.match(/(\d+[A-Z]?) [\w \(\)\-\/\&]+ to (.+)/)
      if (parts) {
        routeNumber = parts[1]
        routeDestination = parts[2].replace(/[ \-]via .+/, '').replace('Limited Express', '')
          .replace(/Shopping.*/, 'SC').replace('RS', '').replace('Station', '').replace(' old', '').replace('FULL', '').replace('Sec Col', 'Secondary College').replace(/  +/g, ' ').trim()

        if (routeDestination === 'AM' || routeDestination === 'PM') return null
      } else parts = routeName.match(/[\w \(\)\-\/\&]+ to (.+)/)

      if (!routeNumber) {
        if (parts) {
          routeNumber = routeName
          routeDestination = parts[1]
        } else routeNumber = routeName
      }
    }

    return {
      routeID: route.id,
      routeNumber,
      routeDestination
    }
  }).filter(Boolean)

  fs.writeFile(path.join(__dirname, 'busminder-routes.json'), JSON.stringify(routes), () => {
    process.exit()
  })
}

main()
