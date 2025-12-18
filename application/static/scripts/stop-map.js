function generateMap(mapID, dataURL, keyStopsOnly) {
  const ATTRIBUTION = '<a id="home-link" target="_top" href="maps.stamen.com">Map tiles</a> by <a target="_top" href="http://stamen.com">Stamen Design</a>, under <a target="_top" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
  let accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ'

  let map = L.map(mapID).setView([-38, 145], 9)

  L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 20,
    id: 'mapbox/dark-v10',
    tileSize: 512,
    zoomOffset: -1,
    accessToken
  }).addTo(map)

  L.control.scale().addTo(map)
  L.control.locate({
    showPopup: false
  }).addTo(map)

  const resizeObserver = new ResizeObserver(() => map.invalidateSize())
  resizeObserver.observe($(`#${mapID}`))

  let stopCSSClasses = {
    'bus': 'busStop',
    'metro train': 'metroStation',
    'regional train': 'vlineStation',
    'heritage train': 'heritageStation',
    'regional coach': 'regionalCoachStop',
    'tram': 'tramStop',
    'ferry': 'ferryTerminal'
  }

  let bayData
  $.ajax({
    url: '/stop-preview/bays',
    method: 'GET'
  }, (err, status, data) => {
    bayData = data

    $.ajax({
      url: dataURL || null,
      method: 'POST'
    }, (err, status, stopData) => {
      const relevantBays = keyStopsOnly
        ? stopData.bays.filter(bay => bay.stopType === 'stop' || bay.stopType === 'entrance')
        : stopData.bays
      relevantBays.forEach(bay => {
        let coordinates = bay.location.coordinates
        let location = [coordinates[1], coordinates[0]]

        const stopClass = bay.stopType === 'entrance' ? 'entrance' : stopCSSClasses[bay.mode]
        let icon = L.divIcon({className: `stopIcon ${stopClass}`})

        let marker = L.marker(location, {icon: icon}).addTo(map)

        let name = bay.fullStopName
        if (bay.stopNumber) name += ` #${bay.stopNumber}`
        if (bayData[bay.stopGTFSID]) name += ` (${bayData[bay.stopGTFSID]})`

        if (bay.screenServices) {
          const serviceText = bay.screenServices.map(e => e.routeNumber).filter((e, i, a) => a.indexOf(e) === i).filter(Boolean).join(', ')
          if (serviceText.length) {
            name += `<br>Services: ${serviceText}`
          }
        }
        name += `<br>Stop ID: ${bay.stopGTFSID}`
        if (bay.tramTrackerID) {
          name += `<br>TramTracker ID: ${bay.tramTrackerID}`
          name += `<br>TramTracker Name: ${bay.tramTrackerName}`
        }

        if (bay.mykiZones && bay.mykiZones.length) {
          if (bay.mykiZones === 'Paper Ticketed') {
            name += '<br>Paper Ticket'
          } else if (bay.mykiZones.includes(0)) {
            name += `<br>Myki: Free Tram Zone`
          } else {
            name += `<br>Myki: Zone${bay.mykiZones.length > 1 ? 's' : ''} ${bay.mykiZones.join(', ')}`
          }
        }

        marker.bindPopup(name)
      })

      if (stopData.trainReplacementBays) {
        stopData.trainReplacementBays.forEach(bay => {
          let coordinates = bay.location.coordinates
          let location = [coordinates[1], coordinates[0]]

          let icon = L.divIcon({className: 'stopIcon busReplacementBay'})

          let marker = L.marker(location, {icon: icon}).addTo(map)

          let name = `${stopData.stationName} Train Replacement Stop`
          if (bay.bayDesignation) name += ` (${bay.bayDesignation})`
          name += `<br>
Towards: ${bay.towards}`

          marker.bindPopup(name)
        })
      }

      stopData.carpark.forEach(carparkData => {
        let {capacity, geometry} = carparkData

        L.geoJSON({
          type: 'Feature',
          geometry
        }, {
          style: {
            color: '#ffffff'
          }
        }).addTo(map).bindPopup(`Carpark<br>Capacity: ${capacity}`)
      })

      stopData.bikes.forEach(carparkData => {
        let {capacity, type, location, geometry} = carparkData
        let icon = L.divIcon({className: 'stopIcon bikeStorage'})
        let marker = L.marker([geometry.coordinates[1], geometry.coordinates[0]], {icon: icon}).addTo(map)

        let name = `Bicycle Storage Area
        <br>Type: ${type}
        <br>Location: ${location}
        <br>Capacity: ${capacity}`

        marker.bindPopup(name)
      })

      stopData.platformGeometry.forEach(platform => {
        let {platformNumber, geometry} = platform

        L.geoJSON({
          type: 'Feature',
          geometry
        }).addTo(map).bindPopup('Platform ' + platformNumber)
      })

      let {bbox} = stopData
      map.fitBounds([bbox.geometry.coordinates[0][0].reverse(), bbox.geometry.coordinates[0][2].reverse()])
    })
  })
}