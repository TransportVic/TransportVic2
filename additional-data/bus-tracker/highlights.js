module.exports = [{
  name: 'Ventura Minibuses',
  track: ['V376', 'V377', 'V1268', 'V1269', 'V1270', 'V1310', 'V1311', 'V1377', 'V1408'],
  routes: ['526', '527', '548', '549', '550', '551', '671', '672', '673', '675', '676', '677', '680', '786', '787', '886', '887', 'TB1', 'TB2', 'TB3', 'TB4', 'TB7', 'TB8', 'TB9'],
  type: 'exclude'
}, {
  name: 'Ventura Artics',
  track: ['V100', 'V102', 'V136', 'V143', 'V190', 'V292', 'V293', 'V294', 'V730', 'V732', 'V733', 'V734', 'V735', 'V842', 'V1271', 'V1374', 'V1378', 'V1379', 'V1380', 'V1422', 'V1423', 'V1424', 'V1426', 'V1427', 'V1463', 'V1464', 'V1466', 'V1470', 'V1478', 'V1479'],
  routes: ['811', '812', '813', '664', '670', '679', '788', '887'],
  type: 'exclude'
}, {
  name: 'Ventura Specials',
  track: ['V143', 'V292', 'V294', 'V343', 'V895', 'V1380', 'V1445', 'V8239'],
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
  routes: ['280', '282', '370', '509'],
  type: 'exclude'
}, {
  name: 'Uni Shuttle Buses',
  track: ['TS16' ,'TS19', 'TS27', 'TS40', 'TS41', 'TS43', 'TS54', 'TS71', 'CO13', 'CO15', 'CO23', 'CO24', 'CO127', 'CO128', 'CO129', 'CO130', 'CO154', 'CO171', 'CO175', 'D897', 'D898', 'D899', 'D900', 'V1255', 'V1256'],
  routes: ['201', '301', '401', '601'],
  type: 'exclude'
}, {
  name: 'Non-Perm Uni Shuttle Buses',
  track: ['TS16' ,'TS19', 'TS27', 'TS40', 'TS41', 'TS43', 'TS54', 'TS71', 'CO13', 'CO15', 'CO23', 'CO24', 'CO127', 'CO128', 'CO129', 'CO130', 'CO154', 'CO171', 'CO175', 'D897', 'D898', 'D899', 'D900', 'V1255', 'V1256'],
  routes: ['201', '301', '401', '601'],
  type: 'include',
  buses: 'exclude'
}, {
  name: 'CDC Oakleigh Specials',
  track: ['CO7', 'CO8', 'CO11', 'CO12', 'CO13', 'CO34', 'CO100', 'CO103', 'CO104', 'CO105', 'CO109'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh Ex-Drivers',
  track: ['CO10', 'CO13', 'CO14', 'CO15', 'CO23', 'CO24', 'CO29', 'CO31', 'CO32', 'CO33', 'CO34', 'CO35', 'CO41', 'CO44', 'CO48', 'CO56', 'CO60', 'CO66', 'CO69', 'CO71', 'CO72', 'CO83', 'CO84', 'CO85', 'CO88', 'CO89', 'CO90', 'CO91'],
  routes: ['605'],
  type: 'include'
}, {
  name: 'CDC Tullamarine Specials',
  track: ['CT53'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Wyndham Specials',
  track: ['CW10', 'CW338', 'CW447'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Ballarat Specials',
  track: ['CB146', 'CB147', 'CB152', 'CB153', 'CB155', 'CB156', 'CB162', 'CB171', 'CB174', 'CB175', 'CB176'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Geelong Specials',
  track: ['CG92', 'CG93', 'CG94', 'CG95', 'CG97', 'CG98', 'CG99', 'CG100', 'CG101', 'CG102'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Sunbury Specials',
  track: ['S35', 'S36'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Kastoria Specials',
  track: ['K13', 'K14', 'K23', 'K24', 'K25', 'K26', 'K28', 'K5001', 'K5007', 'K5026'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Dysons Specials',
  track: ['D184', 'D185', 'D186', 'D189', 'D259', 'D260', 'D281', 'D282', 'D426', 'D427', 'D428', 'D429', 'D430', 'D431', 'D432', 'D433', 'D434', 'D435', 'D754', 'D755', 'D756', 'D757', 'D758', 'D759', 'D760', 'D761', 'D762', 'D763', 'D764', 'D768'],
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
  track: ['MH32', 'MH43', 'MH51', 'MH55', 'MH56', 'MH65', 'MH89', 'MH127', 'MH140', 'MH144', 'MH145', 'MH147', 'MH150'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Warragul Specials',
  track: ['W2043'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Latrobe Specials',
  track: ['LV10', 'LV64', 'LV66', 'LV67'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Seymour Specials',
  track: ['SY68'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Martyr\'s Specials',
  track: ['MT24', 'MT25'],
  routes: [],
  type: 'exclude'
}]
