module.exports = [{
  name: 'Ventura Minibuses',
  track: ['V376', 'V377', 'V1268', 'V1269', 'V1270', 'V1310', 'V1311', 'V1377', 'V1408', 'V1546', 'V1547', 'V1548', 'V1549', 'V1550', 'V1551', 'V1552', 'V1553', 'V1554', 'V1555'],
  routes: ['786', '787'],
  type: 'exclude'
}, {
  name: 'Ventura Artics',
  track: ['V292', 'V293', 'V294', 'V842', 'V1271', 'V1374', 'V1378', 'V1379', 'V1380', 'V1422', 'V1423', 'V1424', 'V1426', 'V1427', 'V1463', 'V1464', 'V1466', 'V1470', 'V1478', 'V1479', 'V1628'],
  routes: ['811', '812', '813', '664', '670', '679', '788', '840', '887', '927'],
  type: 'exclude'
}, {
  name: 'Ventura Specials',
  track: ['V234', 'V238', 'V250', 'V292', 'V293', 'V344', 'V355', 'V588', 'V591', 'V592', 'V766', 'V895', 'V1141', 'V8239'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Ventura CB80',
  track: ['V993'],
  routes: ['735', '736', '765'],
  type: 'include'
}, {
  name: 'Kinetic Minibuses',
  track: ['K119', 'K120', 'K129', 'K130', 'K131', 'K132', 'K133', 'K183'],
  routes: ['280', '282', '509'],
  type: 'exclude'
}, {
  name: 'Kinetic Specials',
  track: ['K406', 'K407', 'K408', 'K409', 'K410', 'K411', 'K761', 'K762'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Uni Shuttle Buses',
  track: ['TS16' ,'TS19', 'TS27', 'TS40', 'TS41', 'TS43', 'TS54', 'TS71', 'CO127', 'CO128', 'CO129', 'CO130', 'CO154', 'CO171', 'CO175', 'D897', 'D898', 'D899', 'D900', 'V1254', 'V1255', 'V1256'],
  routes: ['201', '301', '401', '601'],
  type: 'exclude'
}, {
  name: 'Non-Perm Uni Shuttle Buses',
  track: ['TS16' ,'TS19', 'TS27', 'TS40', 'TS41', 'TS43', 'TS54', 'TS71', 'D897', 'D898', 'D899', 'D900', 'V1254', 'V1255', 'V1256'],
  routes: ['201', '301', '401'],
  type: 'include',
  buses: 'exclude'
}, {
  name: 'CDC Oakleigh Specials',
  track: ['CO13', 'CO31', 'CO34', 'CO35'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh SmartBuses',
  track: ['CO116', 'CO117', 'CO118', 'CO119', 'CO120', 'CO121'],
  routes: ['900'],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh Artics',
  track: ['CO171'],
  routes: ['601'],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh Ex-Drivers',
  track: ['CO13', 'CO14', 'CO15', 'CO23', 'CO31', 'CO33', 'CO34', 'CO35', 'CO44', 'CO56', 'CO60', 'CO88', 'CO89', 'CO90', 'CO91'],
  routes: ['605'],
  type: 'include'
}, {
  name: 'CDC Tullamarine Specials',
  track: ['CT26', 'CT52', 'CT53', 'CT55', 'CT56', 'CG104'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Sunshine Specials',
  track: ['CW416', 'CW445', 'CW446', 'CW447', 'CW453'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Wyndham Specials',
  track: ['CW10', 'CW106', 'CW107', 'CW336', 'CW338', 'CW339', 'CW340', 'CW341'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Geelong Specials',
  track: ['CG103', 'CG105', 'CG106', 'CG107', 'CG113', 'CG116'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Ballarat Specials',
  track: ['CB146', 'CB152', 'CB153', 'CB155', 'CB156', 'CB159', 'CB170', 'CB171', 'CB172', 'CB174', 'CB175', 'CB176', 'CB177', 'CB178', 'CB191', 'CB192', 'CB226', 'CB227'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Sunbury Specials',
  track: ['S35', 'S48', 'S49'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Kastoria Specials',
  track: ['K13', 'K14', 'K23', 'K24', 'K25', 'K26', 'K28', 'K5001', 'K5007', 'K5026'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Dysons Specials',
  track: ['D284', 'D296', 'D297', 'D300', 'D301', 'D302', 'D303', 'D304', 'D760', 'D761', 'D762'],
  routes: [],
  type: 'exclude'
}, {
  name: '509 Perms off 509',
  track: ['K221', 'K222'],
  routes: ['505', '509'],
  type: 'exclude'
}, {
  name: 'Non-509 Perms on 509',
  track: ['K221', 'K222'],
  routes: ['509'],
  type: 'include',
  buses: 'exclude'
}, {
  name: 'McHarry Specials',
  track: ['MH32', 'MH34', 'MH35', 'MH43', 'MH51', 'MH55', 'MH56', 'MH65', 'MH89', 'MH127', 'MH140', 'MH144', 'MH145', 'MH147', 'MH150'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Warragul Specials',
  track: ['W43'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Latrobe Specials',
  track: ['LT10', 'LT64', 'LT66', 'LT67'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Seymour Specials',
  track: ['SY44', 'SY68'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Martyr\'s Specials',
  track: ['MT24', 'MT25', 'MT50'],
  routes: [],
  type: 'exclude'
}, {
  name: 'McKenzies Specials',
  track: ['MK30', 'MK50'],
  routes: [],
  type: 'exclude'
}]
