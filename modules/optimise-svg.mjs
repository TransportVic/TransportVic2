import svgo from 'svgo'
import fs from 'fs/promises'
import path from 'path'
import utils from '../utils.mjs'

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

const results = await utils.walkDir(path.join(import.meta.dirname, '../application/static/images-raw'))
for (const result of results) {
  if (!result.file) continue
  const filePath = result.path
  const finalPath = filePath.replace('/images-raw/', '/images/')
  const dirName = path.dirname(finalPath)

  try { await fs.mkdir(dirName, {recursive: true}) } catch (e) {}

  if (filePath.endsWith('svg')) {
    const data = await fs.readFile(filePath)
    const optimised = await (filePath.includes('/interactives/') ? interactiveOptimise : regularOptimise)(data, filePath)
    const optimisedData = optimised.data
    await fs.writeFile(finalPath, optimisedData)
  } else {
    await fs.copyFile(filePath, finalPath)
  }
}