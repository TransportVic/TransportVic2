let overrides = {
  '4-965': '8-965'
}

module.exports = routeGTFSID => {
  return overrides[routeGTFSID] || routeGTFSID
}
