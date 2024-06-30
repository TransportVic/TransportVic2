let stops = {}

let rwd = {
  "stop_suburb": "Ringwood",
    "stop_name": "Ringwood Station/Maroondah Hwy",
    "route_type": 2,
    "stop_latitude": -37.815080163896,
    "stop_longitude": 145.22988517169,
}
let monash = {
  "stop_suburb": "Clayton",
    "stop_name": "Monash University",
    "route_type": 2,
    "stop_latitude": -37.9136868109722,
    "stop_longitude": 145.131768418562,
    "stop_id": 34082
}

let chelsea = {
  "stop_suburb": "Chelsea",
    "stop_name": "Chelsea Railway Station/Station St",
    "route_type": 2,
    "stop_latitude": -38.0533202689789,
    "stop_longitude": 145.116861077446,
    "stop_id": 34093
}

let tarneit = {
  "stop_suburb": "Tarneit",
    "stop_name": "Tarneit Station",
    "route_type": 2,
    "stop_latitude": -37.8326687887396,
    "stop_longitude": 144.694971480843,
    "stop_id": 34093
}

let hallam = {
  stop_suburb: 'Hallam',
  stop_name: 'Hallam Station/Hallam South Rd',
  stop_id: 34112,
  route_type: 2,
  stop_latitude: -38.01721,
  stop_longitude: 145.271164
}

stops[34082] = { ...monash, stop_id: 34082 }
for (let i = 34083; i <= 34090; i++) stops[i] = { ...rwd, "stop_id": i }
stops[34091] = { ...monash, stop_id: 34091 }
stops[34092] = { ...monash, stop_id: 34092 }
for (let i = 34093; i <= 34095; i++) stops[i] = { ...chelsea, "stop_id": i }
for (let i = 34096; i <= 34102; i++) stops[i] = { ...tarneit, "stop_id": i }
stops[103] = { ...monash, stop_id: 103 }
for (let i = 34104; i <= 34106; i++) stops[i] = { ...monash, "stop_id": i }

stops[34109] = { ...hallam, stop_id: 34109 }

stops[34113] = { ...rwd, stop_id: 34113 }

module.exports = stops