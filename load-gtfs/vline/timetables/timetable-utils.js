function tableToColumnOrder(table) {
  let columns = []
  let columnCount = table[1].length
  let rowCount = table.length

  for (let col = 0; col < columnCount; col++) {
    let colData = []
    for (let row = 0; row < rowCount; row++) {
      colData.push(table[row][col] || '')
    }
    columns.push(colData)
  }

  for (let col = 2; col < columnCount; col++) {
    colData = columns[col]
    let timings = colData.slice(5)
    let actualTimings = timings.filter(Boolean)
    if (actualTimings.length === 0) { // merged cell thing ew
      timings = columns[col - 1].slice(5)
      columns[col] = [...colData.slice(0, 5), ...timings]
    }
  }
  return columns
}

function expandName(name) {
  return name.replace(/Sdg/g, 'Siding')
    .replace(/Jct\.?/g, 'Junction')
    .replace(/Sth/g, 'South')
    .replace(/Exch./g, 'Exchange')
    .replace(/Ter(\b)/g, 'Terminal$1')
    .replace(/Termi(\b)/g, 'Terminal$1')
    .replace(/Mt\.?(\b)/g, 'Mount$1')
    .replace(/Mount\.(\b)/g, 'Mount$1')
    .replace(/Pt(\b)/g, 'Port$1')
    .replace(/ Dep$/i, '')
}

module.exports = {
  tableToColumnOrder,
  expandName
}
