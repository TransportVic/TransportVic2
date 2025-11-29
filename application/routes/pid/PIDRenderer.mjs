import url from 'url'
import path from 'path'
import pug from 'pug'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PID_VIEW = path.join(__dirname, '..', '..', '..', 'vic-pid', 'views')

export default class PIDRender {

  #req
  #res
  #pidStaticBase

  constructor(req, res) {
    this.#req = req
    this.#res = res
    this.#pidStaticBase = res.locals.pidStaticBase
  }

  async render(name, extraScripts=[], options={}) {
    this.#res.status(200)
    this.#res.setHeader('Content-Type', 'text/html; charset=utf-8')
    this.#res.write('')

    const compiled = pug.compileFile(path.join(PID_VIEW, name + '.pug'))({
      ...options,
      pidStaticBase: this.#pidStaticBase,
      extraScripts: extraScripts.map(src => ({ src: this.#res.locals.staticBase + src }))
    })

    this.#res.end(compiled)
  }

}