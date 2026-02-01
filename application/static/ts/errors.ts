import { App } from './app.js';
import { Page, PageState } from './types.js'

export class Error500Page extends Page {

  private HEADER = `
    <span>Error!</span>
    <div id="header-right"><a id="home-button" href="/">Home</a></div>
  `

  private BODY = `<main id="content">
      <div class="errorPage">
        <h2>500: Something's gone wrong...</h2>
        <img src="/static/images/home/500.svg">
        <div>
          <a href="/">Try going home</a>
          <span> Or </span>
          <a href="javascript:history.back()">Going back a page</a>
        </div>
      </div>
    </main>`

  async load(): Promise<void> {
    this.replaceHeaderContent(this.HEADER)
    this.replaceMainContent(this.BODY)
    this.url.pathname = '/500'

    await this.initialiseState()
  }

  setup(app: App): void {}
  destroy(): void {}

  restore() {
    this.load()
  }

}