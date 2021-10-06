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
  process.exit(0)
})
