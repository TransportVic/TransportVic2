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
    return name.replace(/\/.+^/, '')
  }
}
