import CopyGenerator from './CopyGenerator.mjs'

export default class PathwayGenerator extends CopyGenerator {

  #SEEN = new Set()

  getHeader() { return 'pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,traversal_time' }
  getFileName() { return 'pathways.txt' }
  acceptLine(line) {
    if (this.#SEEN.has(line.pathway_id)) return false

    this.#SEEN.add(line.pathway_id)
    return true
  }

}