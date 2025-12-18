import url from 'url'
import path from 'path'
import pug, { renderFile } from 'pug'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PID_VIEW = path.join(__dirname, '..', '..', '..', 'vic-pid', 'views')

export default class PIDRender {

  #req
  #res
  #pidStaticBase
  #staticBase

  constructor(req, res) {
    this.#req = req
    this.#res = res
    this.#pidStaticBase = res.locals.pidStaticBase
    this.#staticBase = res.locals.staticBase
  }

  async render(name, extraScripts=[], options={}) {
    this.#res.setHeader('Content-Type', 'text/html; charset=utf-8')

    const compiled = PIDRender.renderFile(name, this.#pidStaticBase, this.#staticBase, extraScripts, options)

    this.#res.send(compiled)
  }

  static renderFile(name, pidBase, staticBase, extraScripts, options) {
    return pug.compileFile(path.join(PID_VIEW, name + '.pug'))({
      ...options,
      pidStaticBase: pidBase,
      extraScripts: extraScripts.map(src => ({ src: staticBase + src }))
    })
  }

}