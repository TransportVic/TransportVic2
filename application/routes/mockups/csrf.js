const url = require('url')
const { ObjectID } = require('mongodb')

module.exports = async (req, res, next) => {
  if (url.parse(req.url).query === 'metropid') next()
  let csrf = res.db.getCollection('csrf tokens')

  req.csrfToken = async function() {
    let time = +new Date()
    let token = await csrf.createDocument({
      created: time,
      ip: req.socket.remoteAddress,
      uses: [time]
    })

    return token.insertedId.toString()
  }

  if (req.method === 'GET') next()
  else {
    let token = req.body.csrf
    let _id = new ObjectID(token)

    let existingToken = await csrf.findDocument({ _id })
    if (existingToken) {
      await csrf.updateDocument({
        _id
      }, {
        $set: {
          uses: [...existingToken.uses, +new Date()]
        }
      })

      next()
    } else {
      res.json({
        error: 'EBADCSRFTKN'
      })
    }
  }
}
