import path from 'path'
import Generator from './Generator.mjs'
import fs from 'fs/promises'
import CSVLineReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/line-reader.mjs'

export default class CopyGenerator extends Generator {

  #gtfsFolder
  constructor(db, gtfsFolder) {
    super(db)
    this.#gtfsFolder = gtfsFolder
  }

  getHeader() { throw new Error('Not implemented') }
  getFileName() { throw new Error('Not implemented') }

  async generateFileContents(stream) {
    const folders = await fs.readdir(this.#gtfsFolder)
    const headerParts = this.getHeader().split(',')

    stream.write(headerParts.join(','))
    stream.write('\n')

    for (const folder of folders) {
      try {
        const filePath = path.join(this.#gtfsFolder, folder, this.getFileName())

        await this.#streamAndModifyFile(stream, folder, new CSVLineReader(filePath), headerParts)
      } catch (e) {
      }
    }
  }

  processColumn(column, folder, line) {
    return line[column]
  }

  acceptLine(line) { return true }

  async #streamAndModifyFile(stream, folder, reader, headers) {
    await reader.open()
    while (reader.available()) {
      const line = await reader.nextLine()
      if (!this.acceptLine(line)) continue

      stream.write('"')
      stream.write(headers.map(column => this.processColumn(column, folder, line)).join('","'))
      stream.write('"\n')
    }
    await reader.close()
  }

}