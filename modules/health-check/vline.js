const nodeMailin = require('node-mailin')
const cheerio = require('cheerio')

const handleChange = require('./vline/handle-change')
const handleCancellation = require('./vline/handle-cancellation')
const handleReduction = require('./vline/handle-reduction')

const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')

const fs = require('fs')
const stream = fs.createWriteStream('/tmp/mail.txt', { flags: 'a' })

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async err => {})

async function inboundMessage(data) {
  let sender = data.from.text
  if (!sender.includes('@inform.vline.com.au')) return

  let {subject, html} = data
  let $ = cheerio.load(html)
  let textContent = $('center').text()
  textContent = textContent.replace(/SCS/g, 'Southern Cross')

  handleMessage(subject, textContent)
}

async function handleMessage(subject, text) {
  text = text.replace(/\n/g, ' ').replace(/\u00A0/g, ' ').replace(/More information at.+/, '').trim()
  stream.write(`Got mail: Subject: ${subject}. Text: ${text.replace(/\n/g, ' ')}\n`)

  if (subject.includes('Service cancellation') || text.includes('will not run') || text.includes('has been cancelled')) {
    await handleCancellation(database, text)
  } else if (subject.includes('Service reduction') || text.includes('reduced capacity')) {
    await handleReduction(database, text)
  } else {
    await handleChange(database, text)
  }
}

module.exports = () => {
  nodeMailin.start({
    port: 25,
    logLevel: 'error',
    smtpOptions: {
      SMTPBanner: 'TransportVic V/Line Inform Email Server'
    }
  })

  console.log('V/Line Email server started')

  nodeMailin.on('message', (connection, data, content) => {
    inboundMessage(data)
  })

  nodeMailin.on('error', err => {
    console.err(err)
  })
}
