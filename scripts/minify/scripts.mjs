import UglifyJS from 'uglify-js'
import path from 'path'
import fs from 'fs/promises'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function walkDir(dir) {
  async function walk(dir) {
    let results = []
    let list = await fs.readdir(dir)

    for (let file of list) {
      let filePath = path.resolve(dir, file)
      let stat = await fs.stat(filePath)
      results.push({ path: filePath, file: !stat.isDirectory() })

      if (stat.isDirectory()) {
        results.push(...await walk(filePath))
      }
    }

    return results
  }
  return await walk(dir)
}

let originalPath = path.join(__dirname, '..', '..', 'application', 'static', 'scripts')
const allJSFiles = await walkDir(originalPath)
const publicPath = path.join(__dirname, '..', '..', 'public', 'static', 'scripts')
await fs.mkdir(publicPath)

for (let folder of allJSFiles.filter(f => !f.file)) {
  let newFolder = path.join(publicPath, folder.path.slice(originalPath.length + 1))
  await fs.mkdir(newFolder)
}

for (let file of allJSFiles.filter(f => f.file)) {
  let newFile = path.join(publicPath, file.path.slice(originalPath.length + 1))

  if (file.path.endsWith('.js') && !file.path.includes('vendor')) {
    let content = await fs.readFile(file.path)
    let minified = UglifyJS.minify(content.toString())
    await fs.writeFile(newFile, minified.code)
  } else {
    await fs.copyFile(file.path, newFile)
  }
}