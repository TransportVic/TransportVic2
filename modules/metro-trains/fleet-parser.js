module.exports.parseConsist = function parseConsist(consist, metroConsists) {

}

module.exports.getLeadingVehicles =  function getLeadingVehicles(consist) {
  let carriages = consist.split('-')
  if (carriages[0].match(/9\d{3}M/)) { // HCMT
    return [ carriages[0].slice(0, 4) ]
  }
}