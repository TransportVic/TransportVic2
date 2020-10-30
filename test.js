const utils = require('./utils')

utils.request('https://data-exchange-api.vicroads.vic.gov.au/lums', {
  method: 'POST',
  headers: {
    'Host': 'data-exchange-api.vicroads.vic.gov.au',
    'Ocp-Apim-Subscription-Key': '27b2986c7efb4e81b4c1ba5aa3502a20',
    'Content-Type': 'application/soap+xml; action="GetSiteValues"'
  },
  body: `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Body>
    <GetSiteValues xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://transmax.com.au/soap/lumsvalues">
    </GetSiteValues>
  </Body>
</Envelope>`,
  timeout: 10000
}).then(data => {
  console.log(data)
})
