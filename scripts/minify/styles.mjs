import CleanCSS from 'clean-css'
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
  const allCSSFiles = await walkDir(inFolder)
  await fs.mkdir(outFolder)

  for (let folder of allCSSFiles.filter(f => !f.file)) {
    let newFolder = path.join(outFolder, folder.path.slice(inFolder.length + 1))
    await fs.mkdir(newFolder)
  }

  for (let file of allCSSFiles.filter(f => f.file)) {
    let newFile = path.join(outFolder, file.path.slice(inFolder.length + 1))

    if (file.path.endsWith('.css') && !file.path.includes('vendor')) {
      let content = await fs.readFile(file.path)
      let minified = new CleanCSS().minify(content.toString())
      await fs.writeFile(newFile, minified.styles)
    } else {
      await fs.copyFile(file.path, newFile)
    }
  }
}

await run(
  path.join(__dirname, '..', '..', 'application', 'static', 'css'),
  path.join(__dirname, '..', '..', 'public', 'static', 'css')
)

await run(
  path.join(__dirname, '..', '..', 'vic-pid', 'static', 'css'),
  path.join(__dirname, '..', '..', 'public', 'mockups', 'static', 'css')
)