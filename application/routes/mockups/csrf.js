module.exports = async (req, res, next) => {
  req.csrfToken = async function() {
    return ''
  }

  return next()
}
