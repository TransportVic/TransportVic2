require('fs').writeFileSync(__dirname + '/tram-stops.json', JSON.stringify(require('./stops').stops.filter(x=>x.primaryChronosMode === '1').map(x=>{
  let m = x.title.match(/^(D?\d+[a-zA-Z]?)-/)
  let stopName = x.title.split(' #')[0]
  let stopNumber = x.title.split(' #')[1]

  if (m) {
    stopNumber = m[1]
    stopName = stopName.replace(m[0], '')
  }

  return {
    stopName, stopNumber, stopID: x.id
  }
})))
