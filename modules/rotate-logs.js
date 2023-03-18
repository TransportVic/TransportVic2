#! /usr/bin/env node

const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  await database.adminCommand({ logRotate: 'server' })
  for (let dir of config.databaseLog) {
    await new Promise(r => {
      fs.readdir(dir, async (err, files) => {
        for (let file of files) {
          if (!file.endsWith('.log')) {
            fs.unlink(path.join(dir, file), r)
          }
        }
      })
    })
  }
  process.exit(0)
})
