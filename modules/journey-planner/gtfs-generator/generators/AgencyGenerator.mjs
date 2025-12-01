import Generator from './Generator.mjs';

export default class AgencyGenerator extends Generator {

  async generateFileContents() {
    return [
      `agency_id,agency_name,agency_url,agency_timezone`,
      `0,TransportVic,https://transportvic.me,Australia/Melbourne`
    ].join('\n')
  }

}