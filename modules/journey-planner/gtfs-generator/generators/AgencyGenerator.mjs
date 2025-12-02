import Generator from './Generator.mjs';

export default class AgencyGenerator extends Generator {

  async generateFileContents(stream) {
    stream.write(`agency_id,agency_name,agency_url,agency_timezone\n`)
    stream.write(`0,TransportVic,https://transportvic.me,Australia/Melbourne`)
  }

}