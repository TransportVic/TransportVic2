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

async function run(inFolder, outFolder) {
  const allJSFiles = await walkDir(inFolder)
  await fs.mkdir(outFolder)

  for (let folder of allJSFiles.filter(f => !f.file)) {
    let newFolder = path.join(outFolder, folder.path.slice(inFolder.length + 1))
    await fs.mkdir(newFolder)
  }

  for (const file of allJSFiles.filter(f => f.file)) {
    const newFile = path.join(outFolder, file.path.slice(inFolder.length + 1))

    if ((file.path.endsWith('.js') || file.path.endsWith('.mjs')) && !file.path.includes('vendor')) {
      const content = await fs.readFile(file.path)
      const minified = UglifyJS.minify(content.toString(), {
        webkit: true
      })

      await fs.writeFile(newFile, minified.code)
    } else {
      await fs.copyFile(file.path, newFile)
    }
  }
}

await run(
  path.join(__dirname, '..', '..', 'application', 'static', 'js'),
  path.join(__dirname, '..', '..', 'public', 'static', 'js')
)

await run(
  path.join(__dirname, '..', '..', 'application', 'static', 'scripts'),
  path.join(__dirname, '..', '..', 'public', 'static', 'scripts')
)

await run(
  path.join(__dirname, '..', '..', 'vic-pid', 'static', 'scripts'),
  path.join(__dirname, '..', '..', 'public', 'mockups', 'static', 'scripts')
)
