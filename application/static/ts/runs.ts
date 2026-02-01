import { BASE_STATE, Page, PageFactory, PageState } from './types.js'
import { $ } from './util.js'

type RunPageState = PageState & {
  lastUpdateTime: number
}

export class RunPageFactory extends PageFactory {

  canCreatePage(url: URL): boolean {
    return !!url.pathname.match(new RegExp('/.+/run/.+'))
  }

  createPage(url: URL): Page {
    return new RunPage(url)
  }
}

export class RunPage extends Page {

  private updateInterval: number = -1
  protected state: RunPageState = {
    ...BASE_STATE,
    lastUpdateTime: -1
  }

  async load() {
    await this.replacePageData(await fetch(this.url))
  }

  async updateBody() {
    const runData = await (await fetch(this.url, {
      method: 'POST'
    })).text()

    this.updateState(runData)
    this.replaceMainContent(runData)
    this.checkViperLink()
  }

  updateState(runData: string) {
    this.state.content = runData
    this.replacePageState()
  }

  setup() {
    this.updateInterval = setInterval(this.updateBody.bind(this), 30 * 1000)
    this.checkViperLink()
  }

  async getInitialState(): Promise<RunPageState> {
    return {
      ...await super.getInitialState(),
      lastUpdateTime: +new Date()
    }
  }

  checkViperLink() {
    const text = $('#viper-link')

    if (!text) return
    text.addEventListener('click', () => {
      if (window.confirm('Viper says hi! Click Ok to check out his YouTube!')) {
        window.open('https://www.youtube.com/@iluvsiemens', '_blank')
      }
    })
  }

  destroy() {
    clearInterval(this.updateInterval)
  }

  restore() {
    super.restore()

    if ((+new Date() - this.state.lastUpdateTime) > 1000 * 15) this.updateBody()
  }

}