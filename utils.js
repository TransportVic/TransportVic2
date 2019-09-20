module.exports = {
  encodeName: name => name.toLowerCase().replace(/[^\w\d ]/g, '').replace(/  */g, '-').replace(/--+/g, '-'),
  adjustStopname: name => {
    if (name.includes('Railway Station')) {
      name = name.replace('Railway Station', 'Station');
    }

    if (name.includes('Station') && !name.includes('Bus Station')) {
      name = name.replace('Station', 'Railway Station')
    }

    return name
  },
  extractStopName: name => {
    return name.replace(/\/.+$/, '')
  },
  parseGTFSData: data =>
    data.split('\r\n').slice(1).filter(Boolean).map(e => e.match(/"([^"]*)"/g).map(f => f.slice(1, -1))),
  simplifyRouteGTFSID: id => id.replace(/(-\w)?-mjp-1$/, '')
}
