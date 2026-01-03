const isCityService = dep => dep.destination === 'City Loop' || dep.destination === 'Flinders Street'
const hasStop = (stopName, dep) => dep.stops.some(stop => stop.name === stopName && stop.stops)

const MTP_ConcourseTrains = name => ({
  orientation: 'landscape',
  headerStyle: {
    height: '0.08',
    margin: '0.016'
  },
  getComponents: () => {
    const SUY = new CompactServiceList('towards Sunbury', 'metro-tunnel', 4)
    const DNG = new CompactServiceList('towards Pakenham and Cranbourne', 'metro-tunnel', 4)

    const header = new Header(`Trains from ${name}`)
    const area = new ServiceListArea([
      new HalfServiceListArea([
        SUY
      ], 'left'),
      new HalfServiceListArea([
        DNG
      ], 'right')
    ])

    return {
      pids: [{
        pid: SUY,
        filter: dep => hasStop('West Footscray', dep) || hasStop('Footscray', dep)
      }, {
        pid: DNG,
        filter: dep => hasStop('Caulfield', dep) || hasStop('Oakleigh', dep)
      }],
      header,
      area
    }
  }
})

const ConcourseLineGroup = (name, lineGroups, big, small) => ({
  orientation: 'portrait',
  getComponents: () => {
    const pid = new LineGroupServiceList(name, lineGroups[0], big, small)
    const area = new ServiceListArea([
      pid
    ])

    return {
      pids: [{
        pid: pid,
        filter: dep => lineGroups.includes(dep.line)
      }],
      area
    }
  }
})

const FSSDestOverview = side => {
  const SSS = new MiniCompactMultiServiceList('Southern Cross', '', 2)
  const CLP = new MiniCompactMultiServiceList('City Loop', 'Flagstaff, Melbourne Central and Parliament', 2)
  const RMD = new MiniCompactMultiServiceList('Richmond', '', 2)
  const NME = new MiniCompactMultiServiceList('North Melbourne', '', 1)
  const JLI = new MiniCompactMultiServiceList('Jolimont', '', 1)

  const area = new HalfServiceListArea([
    SSS, CLP, RMD, NME, JLI
  ], side)

  return {
    pids: [{
      pid: SSS,
      filter: dep => dep.line !== 'vline' && hasStop('Southern Cross', dep)
    }, {
      pid: CLP,
      filter: dep => dep.stops.some(stop => stop.name === 'Parliament' && stop.stops)
    }, {
      pid: RMD,
      filter: dep => dep.stops.some(stop => stop.name === 'Richmond' && stop.stops)
    }, {
      pid: NME,
      filter: dep => dep.stops.some(stop => stop.name === 'North Melbourne' && stop.stops)
    }, {
      pid: JLI,
      filter: dep => dep.stops.some(stop => stop.name === 'Jolimont' && stop.stops)
    }],
    area
  }
}

export default {
  'melbourne-central': {
    'line-group-portrait': {
      orientation: 'portrait',
      headerStyle: {
        height: '0.05',
        margin: '0.01'
      },
      getComponents: () => {
        const CHL = new MiniCompactServiceList('Mernda & Hurstbridge Lines', 'mernda', 4)
        const NOR = new MiniCompactServiceList('Craigieburn, Sunbury & Upfield Lines', 'craigieburn', 4)
        const BLY = new MiniCompactServiceList('Lilydale, Belgrave, Alamein & Glen Waverley Lines', 'lilydale', 4)
        const DNG = new MiniCompactServiceList('Cranbourne & Pakenham Lines', 'cranbourne', 4)

        const header = new BoldHeader('Trains from Melbourne Central')
        const area = new ServiceListArea([
          CHL, NOR, BLY, DNG
        ])

        return {
          pids: [{
            pid: CHL,
            filter: dep => !isCityService(dep) && ['mernda', 'hurstbridge'].includes(dep.line)
          }, {
            pid: NOR,
            filter: dep => !isCityService(dep) && ['craigieburn', 'sunbury', 'upfield'].includes(dep.line)
          }, {
            pid: BLY,
            filter: dep => !isCityService(dep) && ['lilydale', 'belgrave', 'alamein', 'glen-waverley'].includes(dep.line)
          }, {
            pid: DNG,
            filter: dep => !isCityService(dep) && ['cranbourne', 'pakenham'].includes(dep.line)
          }],
          header,
          area
        }
      }
    }
  },
  'north-melbourne': {
    'line-group-portrait': {
      orientation: 'portrait',
      getComponents: () => {
        const SSS = new MiniCompactMultiServiceList('Southern Cross', '', 2)
        const FSS = new MiniCompactMultiServiceList('Flinders Street', '', 2)
        const CLP = new MiniCompactMultiServiceList('City Loop', 'via Flagstaff, Melbourne Central and Parliament', 2)
        const NOR = new MiniCompactServiceList('Craigieburn, Sunbury & Upfield Lines', 'craigieburn', 3)
        const CCY = new MiniCompactServiceList('Frankston, Werribee, Williamstown & Altona Lines', 'frankston', 3)
        const VLP = new MiniCompactServiceList('Regional Services', 'vline', 1)
        const RCE = new MiniCompactServiceList('Flemington Racecourse Line', 'flemington-racecourse', 1)

        const topArea = new HalfServiceListArea([
          SSS, FSS, CLP
        ], 'top')

        const area = new ServiceListArea([
          topArea, NOR, CCY, VLP, RCE
        ])

        return {
          pids: [{
            pid: SSS,
            filter: dep => dep.direction === 'Up' && hasStop('Southern Cross', dep)
          }, {
            pid: FSS,
            filter: dep => dep.direction === 'Up' && hasStop('Flinders Street', dep)
          }, {
            pid: CLP,
            filter: dep => dep.direction === 'Up' && hasStop('Parliament', dep)
          }, {
            pid: NOR,
            filter: dep => !isCityService(dep) && ['craigieburn', 'sunbury', 'upfield'].includes(dep.line)
          }, {
            pid: CCY,
            filter: dep => !isCityService(dep) && ['frankston', 'williamstown', 'werribee'].includes(dep.line)
          }, {
            pid: VLP,
            filter: dep => dep.direction === 'Down' && ['vline'].includes(dep.line)
          }, {
            pid: RCE,
            filter: dep => !isCityService(dep) && ['flemington-racecourse'].includes(dep.line)
          }],
          area
        }
      }
    }
  },
  'richmond': {
    'concourse-left': {
      orientation: 'landscape',
      headerStyle: {
        height: '0.08',
        margin: '0.016'
      },
      getComponents: () => {
        const BLY = new CompactServiceList('Lilydale, Belgrave, Alamein & Glen Waverley Lines', 'lilydale', 4)
        const CCY = new CompactServiceList('Frankston, Werribee, Williamstown & Altona Lines', 'frankston', 4)
        const DNG = new CompactServiceList('Cranbourne & Pakenham Lines', 'cranbourne', 3)
        const SHM = new CompactServiceList('Sandringham Line', 'sandringham', 2)
        const VLP = new CompactServiceList('Regional Services', 'vline', 1)

        const header = new Header('Trains from Richmond to:')
        const area = new ServiceListArea([
          new HalfServiceListArea([
            BLY, CCY
          ], 'left'),
          new HalfServiceListArea([
            DNG, SHM, VLP
          ], 'right')
        ])

        return {
          pids: [{
            pid: BLY,
            filter: dep => !isCityService(dep) && ['lilydale', 'belgrave', 'alamein', 'glen-waverley'].includes(dep.line)
          }, {
            pid: CCY,
            filter: dep => !isCityService(dep) && ['frankston', 'williamstown', 'werribee'].includes(dep.line)
          }, {
            pid: DNG,
            filter: dep => !isCityService(dep) && ['cranbourne', 'pakenham'].includes(dep.line)
          }, {
            pid: SHM,
            filter: dep => !isCityService(dep) && ['sandringham'].includes(dep.line)
          }, {
            pid: VLP,
            filter: dep => dep.direction === 'Down' && ['vline'].includes(dep.line)
          }],
          header,
          area
        }
      }
    },
    'concourse-right': {
      orientation: 'landscape',
      headerStyle: {
        height: '0.08',
        margin: '0.016'
      },
      getComponents: () => {
        const FSS = new CompactMultiServiceList('Flinders Street', '', 7)
        const CLP = new CompactMultiServiceList('City Loop', 'Parliament, Melbourne Central, Flagstaff', 7)

        const header = new Header('Trains from Richmond to:')
        const area = new ServiceListArea([
          new HalfServiceListArea([
            FSS
          ], 'left'),
          new HalfServiceListArea([
            CLP, new MountableClock('h:mm:ss a')
          ], 'right')
        ])

        return {
          pids: [{
            pid: FSS,
            filter: dep => dep.direction === 'Up' && hasStop('Flinders Street', dep)
          }, {
            pid: CLP,
            filter: dep => dep.direction === 'Up' && hasStop('Parliament', dep)
          }],
          header,
          area
        }
      }
    },
    'line-group-portrait': {
      orientation: 'portrait',
      getComponents: () => {
        const FSS = new MiniCompactMultiServiceList('Flinders Street', '', 2)
        const CLP = new MiniCompactMultiServiceList('City Loop', 'via Flagstaff, Melbourne Central and Parliament', 2)
        const BLY = new MiniCompactServiceList('Lilydale, Belgrave, Alamein & Glen Waverley Lines', 'lilydale', 3)
        const CCY = new MiniCompactServiceList('Frankston, Werribee, Williamstown Lines', 'frankston', 3)
        const DNG = new MiniCompactServiceList('Cranbourne & Pakenham Lines', 'cranbourne', 2)
        const SHM = new MiniCompactServiceList('Sandringham Line', 'sandringham', 1)
        const VLP = new MiniCompactServiceList('Regional Services', 'vline', 1)

        const area = new ServiceListArea([
          FSS, CLP, BLY, CCY, DNG, SHM, VLP
        ])

        return {
          pids: [{
            pid: FSS,
            filter: dep => dep.direction === 'Up' && hasStop('Flinders Street', dep)
          }, {
            pid: CLP,
            filter: dep => dep.direction === 'Up' && hasStop('Parliament', dep)
          }, {
            pid: BLY,
            filter: dep => !isCityService(dep) && ['lilydale', 'belgrave', 'alamein', 'glen-waverley'].includes(dep.line)
          }, {
            pid: CCY,
            filter: dep => !isCityService(dep) && ['frankston', 'williamstown', 'werribee'].includes(dep.line)
          }, {
            pid: DNG,
            filter: dep => !isCityService(dep) && ['cranbourne', 'pakenham'].includes(dep.line)
          }, {
            pid: SHM,
            filter: dep => !isCityService(dep) && ['sandringham'].includes(dep.line)
          }, {
            pid: VLP,
            filter: dep => dep.direction === 'Down' && ['vline'].includes(dep.line)
          }],
          area
        }
      }
    }
  },
  'flinders-street': {
    'concourse-left': {
      orientation: 'landscape',
      headerStyle: {
        height: '0.08',
        margin: '0.016'
      },
      getComponents: () => {
        const CHL = new CompactServiceList('Mernda & Hurstbridge Lines', 'mernda', 4)
        const BLY = new CompactServiceList('Lilydale, Belgrave, Alamein & Glen Waverley Lines', 'lilydale', 4)
        const CCY = new CompactServiceList('Frankston, Werribee, Williamstown & Altona Lines', 'frankston', 4)
        const DNG = new CompactServiceList('Cranbourne & Pakenham Lines', 'cranbourne', 4)

        const header = new Header('Trains from Flinders Street')
        const area = new ServiceListArea([
          new HalfServiceListArea([
            CHL, BLY
          ], 'left'),
          new HalfServiceListArea([
            DNG, CCY
          ], 'right')
        ])

        return {
          pids: [{
            pid: CHL,
            filter: dep => !isCityService(dep) && ['mernda', 'hurstbridge'].includes(dep.line)
          }, {
            pid: BLY,
            filter: dep => !isCityService(dep) && ['lilydale', 'belgrave', 'alamein', 'glen-waverley'].includes(dep.line)
          }, {
            pid: CCY,
            filter: dep => !isCityService(dep) && ['frankston', 'williamstown', 'werribee'].includes(dep.line)
          }, {
            pid: DNG,
            filter: dep => !isCityService(dep) && ['cranbourne', 'pakenham'].includes(dep.line)
          }],
          header,
          area
        }
      }
    },
    'concourse-right': {
      orientation: 'landscape',
      headerStyle: {
        height: '0.08',
        margin: '0.016'
      },
      getComponents: () => {
        const NOR = new CompactServiceList('Craigieburn, Sunbury & Upfield Lines', 'craigieburn', 3)
        const SHM = new CompactServiceList('Sandringham Line', 'sandringham', 2)
        const VLP = new CompactServiceList('Regional Services', 'vline', 1)

        const trainsFromFSS = FSSDestOverview('right')

        const header = new Header('Trains from Flinders Street')
        const area = new ServiceListArea([
          new HalfServiceListArea([
            NOR, SHM, VLP
          ], 'left'),
          trainsFromFSS.area
        ])

        return {
          pids: [{
            pid: NOR,
            filter: dep => ['craigieburn', 'sunbury', 'upfield'].includes(dep.line)
          }, {
            pid: SHM,
            filter: dep => ['sandringham'].includes(dep.line)
          }, {
            pid: VLP,
            filter: dep => dep.direction === 'Down' && ['vline'].includes(dep.line)
          }, ...trainsFromFSS.pids],
          header,
          area
        }
      }
    },
    'line-group-portrait-chl': ConcourseLineGroup('Mernda & Hurstbridge Lines', ['mernda', 'hurstbridge'], 3, 4),
    'line-group-portrait-bly': ConcourseLineGroup('Lilydale, Belgrave, Alamein & Glen Waverley Lines', ['lilydale', 'belgrave', 'alamein', 'glen-waverley'], 3, 4),
    'line-group-portrait-nor': ConcourseLineGroup('Craigieburn, Sunbury & Upfield Lines', ['craigieburn', 'sunbury', 'upfield'], 3, 4),
    'line-group-portrait-dng': ConcourseLineGroup('Cranbourne & Pakenham Lines', ['cranbourne', 'pakenham'], 3, 4),
    'line-group-portrait-ccy': ConcourseLineGroup('Frankston, Werribee & Williamstown Lines', ['frankston', 'werribee', 'williamstown'], 3, 4),
    'line-group-portrait-shm-vlp': {
      orientation: 'portrait',
      getComponents: () => {
        const shm = new LineGroupServiceList('Sandringham Line', 'sandringham', 1, 3, true)
        const vlp = new LineGroupServiceList('Regional V/Line Services', 'vline', 1, 3, true)

        const area = new ServiceListArea([
          shm,
          vlp
        ])

        return {
          pids: [{
            pid: shm,
            filter: dep => ['sandringham'].includes(dep.line)
          }, {
            pid: vlp,
            filter: dep => ['vline'].includes(dep.line)
          }],
          area
        }
      }
    },
    'trains-from-fss-portrait': {
      orientation: 'portrait',
      headerStyle: {
        height: '0.04',
        margin: '0.01'
      },
      getComponents: () => {
        const header = new BoldLineHeader('Trains from Flinders Street to', 'no-line')

        const trainsFromFSS = FSSDestOverview('top')
        const cityLoop = new CityLoop('FSS', 'width', true)

        trainsFromFSS.area.addComponent(cityLoop)

        const area = new ServiceListArea([
          trainsFromFSS.area,
          new MountableClock('h:mm:ss a')
        ], 'no-border')

        return {
          pids: [
            ...trainsFromFSS.pids
          ],
          area,
          header
        }
      }
    },
    'trains-from-fss-landscape': {
      orientation: 'landscape',
      headerStyle: {
        height: '0.08',
        margin: '0.016'
      },
      getComponents: () => {
        const header = new Header('Trains from Flinders Street to', 'no-line')

        const trainsFromFSS = FSSDestOverview('left')
        const cityLoop = new CityLoop('FSS', 'width')

        const area = new ServiceListArea([
          trainsFromFSS.area,
          new HalfServiceListArea([
            cityLoop,
            new MountableClock('h:mm:ss a')
          ], 'right'),
        ])

        return {
          pids: [
            ...trainsFromFSS.pids
          ],
          area,
          header
        }
      }
    },
  },
  'arden': {
    'concourse-trains': MTP_ConcourseTrains('Arden')
  },
  'parkville': {
    'concourse-trains': MTP_ConcourseTrains('Parkville')
  },
  'state-library': {
    'concourse-trains': MTP_ConcourseTrains('State Library')
  },
  'town-hall': {
    'concourse-trains': MTP_ConcourseTrains('Town Hall')
  },
  'anzac': {
    'concourse-trains': MTP_ConcourseTrains('Anzac')
  }
}