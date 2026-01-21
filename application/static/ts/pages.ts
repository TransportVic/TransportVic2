import { Page, PageState } from './types.js'
import { $, inputTimeout } from './util.js'

type SearchPageState = PageState & {
  searchQuery: string
  searchResults: string
}

export class SearchPage extends Page {

  private searchID: number = 0
  protected state: SearchPageState = {
    header: '',
    content: '',
    styles: [],
    searchQuery: '',
    searchResults: ''
  }

  constructor (url: URL) {
    super(url)
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch('/search'))
  }

  setup(): void {
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
    this.setSearchResults(searchResults)
    this.updateState(query, searchResults)
  }

  setSearchResults(searchResults: string) {
    $('#search-results')!.innerHTML = searchResults
  }

  updateState(query: string, searchResults: string) {
    this.state.searchQuery = query
    this.state.searchResults = searchResults

    super.replacePageState()
  }

  destroy() {}

  restore() {
    super.restore();

    ($('#textbar') as HTMLInputElement).value = this.state.searchQuery;
    $('#search-results')!.innerHTML = this.state.searchResults;
  }

}