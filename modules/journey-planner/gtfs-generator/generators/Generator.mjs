export default class Generator {

  constructor(db) {}

  async generateFileContents() { throw new Error() }

  async generateFile() {
    const contents = await this.generateFileContents()
  }

}