const isCityService = dep => dep.destination === 'City Loop' || dep.destination === 'Flinders Street'

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

        const area = new ServiceListArea([
          SSS, FSS, CLP, NOR, CCY, VLP, RCE
        ])

        return {
          pids: [{
            pid: SSS,
            filter: dep => dep.direction === 'Up' && dep.stops.some(stop => stop.name === 'Southern Cross')
          }, {
            pid: FSS,
            filter: dep => dep.direction === 'Up' && dep.stops.some(stop => stop.name === 'Flinders Street')
          }, {
            pid: CLP,
            filter: dep => dep.direction === 'Up' && dep.stops.some(stop => stop.name === 'Parliament')
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
            filter: dep => dep.direction === 'Up' && dep.stops.some(stop => stop.name === 'Flinders Street')
          }, {
            pid: CLP,
            filter: dep => dep.direction === 'Up' && dep.stops.some(stop => stop.name === 'Parliament')
          }],
          header,
          area
        }
      }
    }
  }
}