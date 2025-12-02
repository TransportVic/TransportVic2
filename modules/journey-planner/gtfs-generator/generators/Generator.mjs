export default class Generator {

  constructor(db) {}

  async generateFileContents(stream) { throw new Error() }

  async generateFile() {
    const contents = await this.generateFileContents()
  }

}