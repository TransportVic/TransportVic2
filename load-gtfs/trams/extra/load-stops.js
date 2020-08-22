JSON.stringify(require('./stops').stops.filter(x=>x.primaryChronosMode === '1').map(x=>({stopName: x.title.split(' #')[0], stopNumber: x.title.split(' #')[1], stopID: x.id})))
