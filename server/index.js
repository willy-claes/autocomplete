import express from 'express' // eslint-disable-line
import countries from './countries'

const app = express()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/countries', (req, res) => {
  const suggestions = []

  Object.keys(countries).forEach((code) => {
    if (!req.query.query || countries[code].indexOf(req.query.query) !== -1) {
      suggestions.push({
        value: countries[code],
        data: code,
      })
    }
  })

  res.status(200).json({
    suggestions,
  })
})

app.listen(3000, () => {
  console.log('Express server is running on port 3000.')
})
