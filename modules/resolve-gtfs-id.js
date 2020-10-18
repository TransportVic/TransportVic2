let overrides = {
  '4-965': '8-965',
  '4-74Z': '4-742'
}

module.exports = routeGTFSID => {
  return overrides[routeGTFSID] || routeGTFSID
}
