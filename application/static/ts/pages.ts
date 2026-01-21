import { Page } from './types.js'
import { $, inputTimeout } from './util.js'

export class SearchPage extends Page {

  private searchID: number = 0

  constructor (url: URL) {
    super(url)
  }

  async setup(): Promise<any> {
    await this.replacePageData(await fetch('/search'))
  }

  load(): void {
    inputTimeout($('#textbar') as HTMLInputElement, this.performSearch.bind(this))
  }

  async performSearch() {
    const currentSearchID = ++this.searchID
    const query = ($('#textbar') as HTMLInputElement).value

    $('#loading')!.style = 'display: block;'
    const searchResults = await (await fetch('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' }
    })).text()

    // Out of date
    if (currentSearchID !== this.searchID) return

    $('#loading')!.style = 'display: none;'
    $('#search-results')!.innerHTML = searchResults
  }

  destroy() {}

}