import path from 'path'
import Generator from './Generator.mjs'
import fs from 'fs/promises'
import CSVLineReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/line-reader.mjs'

export default class CalendarGenerator extends Generator {

  #gtfsFolder
  constructor(db, gtfsFolder) {
    super(db)
    this.#gtfsFolder = gtfsFolder
  }

  async generateFileContents(calendarStream, calendarDateStream) {
    const folders = await fs.readdir(this.#gtfsFolder)
    const calendarHeaderParts = 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date'.split(',')
    const calendarDateHeaderParts = 'service_id,date,exception_type'.split(',')

    calendarStream.write(calendarHeaderParts.join(','))
    calendarStream.write('\n')

    calendarDateStream.write(calendarDateHeaderParts.join(','))
    calendarDateStream.write('\n')

    for (const folder of folders) {
      try {
        const calendarFile = path.join(this.#gtfsFolder, folder, 'calendar.txt')
        const calendarDateFile = path.join(this.#gtfsFolder, folder, 'calendar_dates.txt')

        await this.#streamAndModifyFile(calendarStream, folder, new CSVLineReader(calendarFile), calendarHeaderParts)
        await this.#streamAndModifyFile(calendarDateStream, folder, new CSVLineReader(calendarDateFile), calendarDateHeaderParts)
      } catch (e) {
      }
    }
  }

  async #streamAndModifyFile(stream, folder, reader, headers) {
    await reader.open()
    while (reader.available()) {
      const line = await reader.nextLine()
      stream.write('"')
      stream.write(headers.map(column => 
        column === 'service_id' ? `${folder}_${line[column]}` : line[column]
      ).join('","'))
      stream.write('"\n')
    }
    await reader.close()
  }

}