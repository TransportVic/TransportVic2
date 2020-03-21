(function(exports){

    exports.LEDMatrix = class LEDMatrix {

        constructor(width, height, container, matrixType, ...underlyingMatrixArguments) {
            this.width = width;
            this.height = height;
            this.scrollInterval = -1;
            matrixType = matrixType || DOMBasedLEDMatrix;

            this.matrix = new matrixType(width, height, container, ...underlyingMatrixArguments);

            this.inverted = false;
        }

        drawText(text, colour) {
            let font = text.font.data;
            let chars = [...text.text];
            let dx = text.position.x,
                dy = text.position.y;

            let spaceWidth = text.font.getModifier('Space-Width');

            let x = dx;

            chars.forEach((char, pos) => {
                let spacing = 0;
                if (pos !== 0)
                    spacing = text.determineDistance(chars[pos - 1], char);

                x += spacing;

                if (char == ' ' && spaceWidth !== undefined) {
                    x += spaceWidth * 1;
                    return;
                }

                if (!font[char]) {
                  throw new Error('Could not find character ' + char)
                }

                if (font[char].offset)
                    this.draw2DArray(font[char].data, x, dy + font[char].offset, colour, false);
                else
                    this.draw2DArray(font[char], x, dy, colour, false);

                x += (font[char].data || font[char])[0].length;
            });
        }

        draw2DArray(array, x, y, colour, override) {
            override = override == null ? true : override;
            array.forEach((row, dy) => {
                row.forEach((led, dx) => {
                    if (led)
                        this.matrix.setLEDState(x + dx, y + dy, !this.inverted, colour);
                });
            });
        }

        onBeginDraw() {
            if (this.matrix.onBeginDraw) this.matrix.onBeginDraw();
        }

        onEndDraw() {
            if (this.matrix.onEndDraw) this.matrix.onEndDraw();
        }

        clearRectangle(x, y, w, h, colour) {
            if (this.matrix.clearRectangle) this.matrix.clearRectangle(x, y, w, h, colour);

            else for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    this.matrix.setLEDState(x + dx, y + dy, this.inverted, colour);
                }
            }
        }

    }

    exports.CanvasBasedLEDMatrix = class CanvasBasedLEDMatrix {

        constructor(width, height, canvas, scaleFactor) {
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            this.scaleFactor = scaleFactor;
            this.width = width;
            this.height = height;

            this.canvas = canvas;
            this.context = this.canvas.getContext('2d');

            this.buffer = [];
            for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);

            this.flatToTwodim = exports.DOMBasedLEDMatrix.flatToTwodim;
            this.twodimToFlat = exports.DOMBasedLEDMatrix.twodimToFlat;
        }

        clearRectangle(x, y, w, h, colour) {
            this.context.clearRect(x * this.scaleFactor, y * this.scaleFactor, w * this.scaleFactor, h * this.scaleFactor);
        }

        onBeginDraw() {
            this.buffer = [];
            for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);
            this.context.clearRect(0, 0, this.width * this.scaleFactor, this.height * this.scaleFactor);
        }

        onEndDraw() {
            this.buffer.forEach((pixel, n) => {
                let {x, y} = this.flatToTwodim(n, this.width);
                if (pixel)
                    this.context.fillRect(x * this.scaleFactor, y * this.scaleFactor, this.scaleFactor, this.scaleFactor);
            });
        }

        setLEDState(x, y, state, colour) {
            if (x >= this.width || x < 0 || y >= this.height || y < 0) return;
            this.buffer[this.twodimToFlat(x, y, this.width)] = state;
        }

        getLEDState(x, y) {
            return !!this.context.getImageData(x * this.scaleFactor, y * this.scaleFactor, 1, 1).data[0];
        }

    }

    exports.BufferedMatrix = class BufferedMatrix {

      constructor(width, height) {
          this.width = width;
          this.height = height;

          this.buffer = [];
          for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);

          this.flatToTwodim = exports.DOMBasedLEDMatrix.flatToTwodim;
          this.twodimToFlat = exports.DOMBasedLEDMatrix.twodimToFlat;
      }

      clearRectangle(x, y, w, h, colour) {
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            this.setLEDState(x + dx, y + dy, false);
          }
        }
      }

      onBeginDraw() {
          this.buffer = [];
          for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);
      }

      onEndDraw() {
      }

      setLEDState(x, y, state, colour) {
          if (x >= this.width || x < 0 || y >= this.height || y < 0) return;
          this.buffer[this.twodimToFlat(x, y, this.width)] = state;
      }

      getLEDState(x, y) {
          return !!this.buffer[this.twodimToFlat(x, y, this.width)];
      }
    }

    exports.DOMBasedLEDMatrix = class DOMBasedLEDMatrix {

        constructor(width, height, container) {
            this.leds = [];
            this.width = width;
            this.height = height;

            let totalLEDCount = width * height;

            let cells = [];

            for (let ledNumber = 0; ledNumber < totalLEDCount; ledNumber++) {
                let ledCell = document.createElement('div');
                ledCell.className = 'led-cell';

                let led = document.createElement('div');
                led.className = 'led led-off';
                ledCell.appendChild(led);

                this.leds.push(led);
                cells.push(ledCell)
            }

            this.leds.forEach(led => {
                container.appendChild(led);
            });
        }

        static twodimToFlat(x, y, width) {
            return y * width + x;
        }

        static flatToTwodim(n, width) {
            return { x: n % width, y: Math.floor(n / width) };
        }

        setLEDState(x, y, state, colour) {
            if (x >= this.width || x < 0 || y >= this.height || y < 0) return;
            let pixel = this.leds[exports.DOMBasedLEDMatrix.twodimToFlat(x, y, this.width)];
            if (!state && pixel.className.includes('-coloured')) {
                pixel.style.backgroundColor = null;
            }

            let className = state ? 'led led-on' : 'led led-off';
            if (state && colour) {
                className += '-coloured';
                pixel.style.backgroundColor = (typeof colour == 'number' ? '#' : '') + colour.toString('16');
            }
            pixel.className = className;
        }

        getLEDState(x, y) {
            if (x >= this.width || x < 0 || y >= this.height || y < 0) return false;
            return this.leds[exports.DOMBasedLEDMatrix.twodimToFlat(x, y, this.width)].className.includes('led led-on');
        }

    }

    exports.FlipdotMatrix = class FlipdotMatrix extends exports.DOMBasedLEDMatrix {
        constructor(width, height, container) {
            super(width, height, container);

            this.buffer = [];
            for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);

            this.twodimToFlat = exports.DOMBasedLEDMatrix.twodimToFlat;
        }

        clearRectangle(x, y, w, h, colour) {
            this.buffer = this.buffer.map(_ => false);
        }

        onBeginDraw() {
            this.buffer = [];
            for (let i = 0; i < this.width * this.height; i++) this.buffer.push(false);
        }

        onEndDraw() {
            for (let dx = 0; dx < this.width; dx++) {
                setTimeout(() => {
                    for (let dy = 0; dy < this.height; dy++) {
                        super.setLEDState(dx, dy, this.buffer[this.twodimToFlat(dx, dy, this.width)]);
                    }
                }, dx * 10);
            }
        }

        setLEDState(x, y, state, colour) {
            if (x >= this.width || x < 0 || y >= this.height || y < 0) return;
            this.buffer[this.twodimToFlat(x, y, this.width)] = state;
        }

        getLEDState(x, y) {
            return !!this.buffer[this.twodimToFlat(x, y, this.width)];
        }
    }


}(typeof exports === 'undefined' ? window : exports));
