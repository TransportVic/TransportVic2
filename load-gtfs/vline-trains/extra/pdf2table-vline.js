// heavily modified from pdf2table for vline

/*
Copyright (c) 2015 Sam Decrock <sam.decrock@gmail.com>

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var path = require('path')
var PDFParser = require("pdf2json")

function parse(pdfBuffer, callback) {
  var pdfParser = new PDFParser()

  // adding try/catch/printstack 'cause pdfParser seems to prevent errors from bubbing up (weird implementation).
  // It also doesn't seem to implement the callback(err, otherdata) convention used in most Node.js modules, so let's fix that here.
  pdfParser.on("pdfParser_dataReady", function(data) {
    try {
      pdfParserCallback(null, data)
    } catch (err) {
      console.log(err.stack)
    }
  })

  pdfParser.on("pdfParser_dataError", function(err) {
    try {
      pdfParserCallback(err, null)
    } catch (err) {
      console.log(err.stack)
    }
  })


  function pdfParserCallback(err, data) {
    if (err) return callback(err)

    // PDF's contain pages and each page contains Texts. These texts have an x and y value.
    // So finding Texts with equal y values seems like the solution.
    // However, some y values are off by 0.010 pixels/points so let's first find what the smallest y value could be.

    // Let's find Texts with the same x value and look for the smallest y distance of these Texts (on the same page of course)
    // Then use those smallest y values (per page) to find Texts that seem to be on the same row
    // If no smallest y value (per page) can be found, use 0 as smallest distance.


    // now lets find Texts with 'the same' y-values, Actually y-values in the range of y-smallestYValue and y+smallestYValue:
    var myPages = []

    for (var p = 0; p < data.Pages.length; p++) {
      var page = data.Pages[p]
      var fills = page.Fills
      var verticalFills = fills.filter(fill => {
        return fill.h > fill.w
      })
      var horizontalFills = fills.filter(fill => {
        return fill.h < fill.w
      })

      let colStarts = verticalFills.map(fill => fill.x).filter((e, i, a) => a.indexOf(e) === i).sort((a, b) => a - b)
      let rowStarts = horizontalFills.map(fill => fill.y).filter((e, i, a) => a.indexOf(e) === i).sort((a, b) => a - b)
      var rows = [] // store Texts and their x positions in rows

      for (var t = 0; t < page.Texts.length; t++) {
        var text = page.Texts[t]
        let textContent = decodeURIComponent(text.R[0].T)

        let firstYGreater = rowStarts.find(r => r > text.y + 0.1)
        let difference = firstYGreater - text.y
        let currentRow = rowStarts.indexOf(firstYGreater) - 1
        if (difference > 0.6) currentRow--

        if (currentRow < 0) continue
          // y value of Text falls within the y-value range, add text to row:

        if (!['EMPTY', 'LIGHT_LO', 'PSNG_SRV', 'QL', 'PN', 'SSR', 'Train Movement Type'].includes(textContent) && currentRow === 4)
          currentRow = 3

        let xThreshold = 0.03

        if (text.w < 2.85) {
          xThreshold = 0.1
        } else if (text.w < 3) {
          xThreshold = 0.2
        } else if (text.w > 3.9) {
          xThreshold = 0.5
        }

        if (currentRow === 0 && !textContent.includes('Business') && textContent.length > 4) xThreshold = 0.3
        if (currentRow === 1 && !textContent.includes('Days') && textContent.length > 4) xThreshold = 0.3

        let currentCol = colStarts.findIndex(c => c > text.x + xThreshold) - 1
        if (currentCol === -1) currentCol = 0
        if (textContent === 'Arr') currentCol = 1

        if (!rows[currentRow]) {
          // create new row:
          rows[currentRow] = {
            y: text.y,
            data: []
          }
        }

        if (!rows[currentRow].data[currentCol]) {
          rows[currentRow].data[currentCol] = {
            text: textContent,
            x: text.x
          }
        } else {
          rows[currentRow].data[currentCol].text += ` ${textContent}`
        }
      }

      // rows = rows.filter(Boolean)
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i]) rows[i] = {y:0,data:[]}
        for (let j = 0; j < rows[i].data.length; j++) {
          if (!rows[i].data[j]) {
            rows[i].data[j] = {text: '', x: 0}
          }
        }
      }

      // add rows to pages:
      myPages.push(rows)
    }

    callback(null, myPages.map(p => {
      return p.map((row, i) => {
        if (row.data.length === 0) {
          let previousRow = p[i - 1]
          return Array(previousRow.size).fill('')
        }
        return row.data.map(g => g.text)
      })
    }), myPages)
  }

  pdfParser.parseBuffer(pdfBuffer)
}

exports.parse = function (pdfBuffer) {
  return new Promise((resolve, reject) => {
    parse(pdfBuffer, (err, pages) => {
      if (err) reject(err)
      else resolve(pages)
    })
  })
}
