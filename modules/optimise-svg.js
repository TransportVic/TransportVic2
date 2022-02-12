const svgo = require('svgo')
const fs = require('fs')
const path = require('path')

function regularOptimise(data, file) {
  return svgo.optimize(data, {
    path: file,
    plugins: [{
      name: 'removeUnknownsAndDefaults',
      params: {
        overrides: {
          keepRoleAttr: true
        }
      }
    }]
  })
}

function interactiveOptimise(data, file) {
  return svgo.optimize(data, {
    path: file,
    plugins: [{
      name: 'removeUnknownsAndDefaults',
      active: false
    }]
  })
}

function walk(dir, done) {
  let results = []
  fs.readdir(dir, function(err, list) {
    if (err) return done(err)
    let i = 0
    function next() {
      let file = list[i++]
      if (!file) return done(null, results)
      file = path.resolve(dir, file)
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res)
            next()
          })
        } else {
          results.push(file)
          next()
        }
      })
    }
    next()
  })
}

walk(path.join(__dirname, '../application/static/images-raw'), (err, results) => {
  results.forEach(result => {
    let finalPath = result.replace('/images-raw/', '/images/')
    let dirName = path.dirname(finalPath)
    fs.mkdirSync(dirName, {recursive: true})

    if (result.endsWith('svg')) {
      fs.readFile(result, async (err, data) => {
        let optimised = await (result.includes('/interactives/') ? interactiveOptimise : regularOptimise)(data, result)
        let optimisedData = optimised.data
        fs.writeFileSync(finalPath, optimisedData)
      })
    } else {
      fs.copyFileSync(result, finalPath)
    }
  })
})
