#! /usr/bin/env node

const config = require('../config.json')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  await database.adminCommand({ logRotate: 'server' })
  fs.readdir(config.databaseLog, async (err, files) => {
    for (let file of files) {
      if (!file.endsWith('.log')) {
        await new Promise(r => {
          fs.unlink(path.join(config.databaseLog, file), r)
        })
      }
    }
    process.exit(0)
  })
})
