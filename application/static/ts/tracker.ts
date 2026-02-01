import { Page, PageFactory, StaticPage } from './types.js'

export class TrackerPageFactory extends PageFactory {

  canCreatePage(url: URL): boolean {
    return !!url.pathname.match(new RegExp('^/.+/tracker(/|$)'))
  }

  createPage(url: URL): Page {
    return new StaticPage(url, url.pathname)
  }
}