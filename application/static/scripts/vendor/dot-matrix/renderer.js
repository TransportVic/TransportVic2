(function(exports){

    exports.Position = class Position {

        constructor(x, y) {
            this.x = x;
            this.y = y;
        }

    }

    exports.TextObject = class TextObject {

        constructor(text, font, position, spacing) {
            this.text = text;
            this.font = font;
            this.position = position;
            this.spacing = spacing;
        }

        static fromJSONTextObject(data) {
            return new TextObject(data.text, Font.fromNameString(data.font), null, data.spacing);
        }

        static fromJSON(data, font, spacing) {
            let text;
            if (typeof data == 'string') {
                if (typeof font == 'string') {
                    font = Font.fromNameString(font);
                }
                text = new TextObject(data, font, null, spacing);
            } else if (data instanceof Array) {
                text = new MultiFontTextObject(data, font, null, spacing);
            } else { // JSONTextObject
                text = TextObject.fromJSONTextObject(Object.assign(data, {spacing}));
            }

            return text;
        }

        determineDistance(prevChar, currChar) {
            let width = 0;

            if (typeof this.spacing !== 'number')
                this.spacing = 1;

            if (this.font.spacer) {
                return this.font.spacer(prevChar, currChar, this.spacing);
            } else {
                return this.spacing;
            }
        }

        takeMeasure() {
            let chars = [...this.text];
            let font = this.font;

            let customSpacing = font.getModifier('Space-Width');

            let totalWidth = chars.reduce((totalWidth, char, pos) => {
                if (pos !== 0) {
                    totalWidth += this.determineDistance(chars[pos - 1], char);
                }

                if (!font.data[char]) throw Error(`Character ${char} in font ${font.name} not found!`)

                if (char === ' ' && customSpacing !== undefined)
                    totalWidth += customSpacing * 1;
                else
                    totalWidth += (font.data[char].data || font.data[char])[0].length;

                return totalWidth;
            }, 0);

            let height = chars.map(char => (font.data[char].data || font.data[char]).length).sort((a, b) => a - b).reverse()[0];

            let offset = chars.map(char => (font.data[char].offset || 0)).sort((a, b) => a - b)[0];

            return {width: totalWidth, height, offset};
        }

        get width() {
            return this.takeMeasure().width;
        }

        get height() {
            return this.takeMeasure().height;
        }

    }

    exports.MultiFontTextObject = class MultiFontTextObject extends exports.TextObject {

        constructor(text, font, position, spacing) {
            super();
            this.text = text.map(textSection => TextObject.fromJSON(textSection, null, spacing));

            this.position = position;
            this.modifiers = exports.Font.getModifiers(' ;' + font);
        }

        getModifier(name) {
            return (this.modifiers.filter(e => e[0] === name)[0] || [])[1];
        }

        takeMeasure() {
            return this.text.map(textSection => {return {measure: textSection.takeMeasure(), text: textSection}}).reduce((overall, textSection, i) => {
                let {measure, text} = textSection;

                overall.width += measure.width;
                if (i < this.text.length - 1)
                    overall.width += text.spacing;

                if (measure.height > overall.height) overall.height = measure.height;
                if (measure.offset < overall.offset) overall.offset = textSectionMeasure.offset;

                return overall;
            }, { width: 0, height: 0, offset: 0 });
        }

    }

    exports.Font = class Font {

        constructor(name, modifiers) {
            this.name = name;
            this.modifiers = modifiers || [];

            if (!fonts[name]) throw new Error(`Font ${name} not found!`);
            this.data = fonts[name];

            this.spacer = fontSpacers[name];
        }

        getModifier(name) {
            return (this.modifiers.filter(e => e[0] === name)[0] || [])[1];
        }

        static getFontname(fontname) {
            return fontname.match(/^([^;]+)/)[1];
        }

        static getModifiers(fontname) {
            return (fontname.match(/^[^;]+;(.+)/) || ['',''])[1].split(',').filter(p => p.length).map(e => e.split('='));
        }

        static fromNameString(name) {
            let fontname = Font.getFontname(name);
            let modifiers = Font.getModifiers(name);

            return new Font(fontname, modifiers);
        }

    }

    exports.Image = class Image {

        constructor(name, allImages, position) {
            this.name = name;
            this.position = position;

            if (!allImages[name]) throw new Error(`Image ${name} not found!`);

            this.data = allImages[name];

            this.width = this.data[0].length;
            this.height = this.data.length;
        }

    }

    exports.GroupObject = class GroupObject {

        constructor(objects, position, width, height) {
            this.objects = objects;
            this.position = position;
            this.width = width;
            this.height = height;
        }

    }

    exports.FormattingTemplate = class FormattingTemplate {

        constructor(template, data) {
            this.template = template;
            this.data = data;
        }

        solveAll() {
            let solved = {};

            if (typeof this.template == 'function') return this.template;

            Object.keys(this.template).forEach(key => {
                let value = this.template[key];

                if (typeof value == 'object') {
                    if (value.$$cond) { // conditionalvalue
                        value = this.solveConditonal(value.$$cond);
                    } else {
                        let innerTemplate = new FormattingTemplate(value, this.data);
                        value = innerTemplate.solveAll();
                    }
                } else {
                    if (typeof value !== 'function')
                        value = this.resolveValue(value);
                }

                solved[key] = value;
            });

            return solved;
        }

        resolveValue(value) {
            value = value.toString();
            let parts = value.split('+');
            let result = null;

            if (parts.length === 1) result = this.resolveVariable(value);
            else result = parts.map(part => {
                let resolved = this.resolveVariable(part);
                if (resolved instanceof Array && resolved[0].text)
                    resolved = resolved.map(section => section.text);

                return resolved;
            }).join('');

            return result;
        }

        resolveVariable(variable) {
            if (typeof variable == 'object') return variable;
            variable = variable.toString();
            if (variable === "null") return null;
            if (variable === "undefined") return undefined;

            if (variable.startsWith('$')) {
                let subObjects = variable.split('.');
                let variableName = subObjects[0].slice(1);
                subObjects = subObjects.slice(1);

                let object = this.data[variableName];
                subObjects.forEach(subObjectsName => {
                    object = object[subObjectsName];
                });
                return object;
            }
            if (variable.startsWith("'") && variable.endsWith("'")) return variable.slice(1, -1);

            if (isNaN(variable * 1)) return variable;
            else return variable * 1;
        }

        solveConditonal(cases) {
            let value = null;
            let found = false;
            let data = this.data;

            Object.keys(cases).forEach(case_ => {
                if (case_ === 'else') {
                    if (!found) {
                        value = cases[case_];
                        found = true;
                    }
                    return;
                }

                let parts = case_.split(' ');
                let variable = this.resolveVariable(parts[0], data),
                    sign = parts[1],
                    check = this.resolveVariable(parts[2], data);

                    switch (sign) {
                        case '===':
                        case '==':
                            if (variable == check && !found) {
                                value = cases[case_];
                                found = true
                            }
                            break;

                        case '!==':
                        case '!=':
                            if (variable != check && !found) {
                                value = cases[case_];
                                found = true
                            }
                            break;

                        case '|==':
                            if (variable.includes(check) && !found) {
                                value = cases[case_];
                                found = true;
                            }
                            break;
                    }
            });

            return this.resolveValue(value, data);
        }

    }

    exports.RenderedOutput = class RenderedOutput {

        constructor(pages, scrollSpeed, displayName) {
            this.pages = pages;
            this.scrollSpeed = scrollSpeed;
            this.displayName = displayName;
        }

    }


    exports.RenderedOutputPage = class RenderedOutputPage {

        constructor(objects) {
            this.objects = objects;
        }

    }

    exports.solveAlignment = function solveAlignment(align, objectWidth, objectHeight, matrixWidth, matrixHeight) {
        let x = 0;
        let y = 0;
        let alignments = align.split(',');

        if (alignments.includes('right')) x = matrixWidth - objectWidth; else x = 0;
        if (alignments.includes('bottom')) y = matrixHeight - objectHeight; else y = 0;
        if (alignments.includes('centre-x')) {
            x = Math.floor(matrixWidth / 2 - objectWidth / 2);
        }
        if (alignments.includes('centre-y')) {
            y = Math.floor(matrixHeight / 2 - objectHeight / 2);
        }

        return {x, y};
    }

    exports.parseMarginShifts = function parseMarginShifts(value, sections) {
        if (!isNaN(value)) return value;

        let offset = 0;
        let parts = value.split(' ');
        let sign = 1;
        parts.forEach(part => {
            if (part == '+') sign = 1;
            else if (part == '-') sign = -1;
            else if (part.startsWith('width(') && part.endsWith(')')) {
                let sectionName = part.slice(6, -1);
                offset += sections[sectionName].width * sign;
            } else if (part.startsWith('len(') && part.endsWith(')')) {
                offset += part.slice(4, -1) * sign;
            }
        });

        return offset;
    }

    exports.adjustMargins = function adjustMargins(object, allObjects, data) {
        let xmod = 1, ymod = 1;
        if (object.alignment.includes('centre-x')) xmod = 0.5;
        if (object.alignment.includes('centre-y')) ymod = 0.5;

        let {margins} = object;
        let {x, y} = object.position;
        let dx = 0, dy = 0;

        Object.keys(margins).forEach(margin => {
            let shift = parseMarginShifts(margins[margin], allObjects);

            switch(margin) {
                case 'left':
                    dx += Math.round(shift * xmod);
                    break;
                case 'right':
                    dx -= Math.round(shift * xmod);
                    break;
                case 'top':
                    dy += Math.round(shift * ymod);
                    break;
                case 'bottom':
                    dy -= Math.round(shift * ymod);
                    break;
            }
        });

        object.position = new Position(x + dx, y + dy);
        if (object instanceof MultiFontTextObject)
            Object.keys(object.text).forEach(key => {
                object.text[key].position.x += object.position.x;
                object.text[key].position.y += dy;
            });

        return object;
    }

    exports.resolveTextPosition = function resolveTextPosition(text, alignment, matrix) {
        let {width, height} = matrix;

        let measure = text.takeMeasure();

        let {x, y} = solveAlignment(alignment, measure.width, measure.height, width, height);
        y += measure.offset;

        text.position = new Position(x, y);

        if (text instanceof MultiFontTextObject) {
            let totalMeasure = text.takeMeasure();
            let align = text.getModifier('align');
            let dx = 0;

            text.text = text.text.map(textSection => {
                let measure = textSection.takeMeasure();
                let dy = 0;
                if (align == 'centre') {
                    dy += Math.ceil((totalMeasure.height - measure.height) / 2);
                } else if (align == 'bottom') {
                    dy += totalMeasure.height - measure.height
                }
                textSection.position = new Position(dx, y + dy);

                dx += measure.width;
                dx += textSection.spacing;
                return textSection;
            });
        }

        return text;
    }

    exports.resolveImagePosition = function resolveImagePosition(image, alignment, matrix) {
        let {width, height} = matrix;

        let {x, y} = solveAlignment(alignment, image.width, image.height, width, height);

        image.position = new Position(x, y);

        return image;
    }

    exports.parseSection = function parseSection(sectionFormatting, formats, data, images, matrix) {
        let alignment = sectionFormatting.align;
        let margins = sectionFormatting.margin;
        let spacing = sectionFormatting.spacing;

        if (sectionFormatting.$$group) {
            let parsedGroupObjects = {};
            let groupWidth = 0;
            let groupHeight = matrix.height;

            groupWidth = Object.keys(sectionFormatting.$$group).map(name => {
                return parseSection(sectionFormatting.$$group[name], formats, data, images, matrix).width;
            }).sort((a, b) => b - a)[0];

            let fakeMatrix = { width: groupWidth, height: groupHeight };

            Object.keys(sectionFormatting.$$group).forEach(name => {
                parsedGroupObjects[name] = parseSection(sectionFormatting.$$group[name], formats, data, images, fakeMatrix);
            });

            let {x} = solveAlignment(alignment, groupWidth, groupHeight, matrix.width, matrix.height);

            let group = new GroupObject(parsedGroupObjects, new Position(x, 0), groupWidth, groupHeight);
            group.alignment = alignment;
            group.margins = margins;

            return group;
        } else if (sectionFormatting.rotate) {
            let scrolls = sectionFormatting.scrolls;
            let scrollObjects = [];
            if (scrolls.length === 0) scrolls.push(" ");

            let defaultScrollFont = Font.fromNameString(sectionFormatting.font);

            scrolls.forEach(scroll => {
                let text;

                if (scroll.renderType) {
                    let rendered = parseFormat(formats, scroll, images, matrix);
                    scrollObjects.push({ rendered });
                    return;
                } else {
                    text = TextObject.fromJSON(scroll, defaultScrollFont, spacing);
                }

                text = resolveTextPosition(text, alignment, matrix);
                text.margins = margins;
                text.alignment = alignment;

                scrollObjects.push(text);
            });

            let scrollSpeed = sectionFormatting.rotateSpeed;

            return { scrollObjects, scrollSpeed };
        } else if (sectionFormatting.image) {
            let imageName = sectionFormatting.image;

            let image = new Image(imageName, images, null);
            image = resolveImagePosition(image, alignment, matrix);
            image.margins = margins;
            image.alignment = alignment;

            return image;
        } else {
            let font = sectionFormatting.font;
            let text = sectionFormatting.text;

            text = TextObject.fromJSON(text, font, spacing);
            text = resolveTextPosition(text, alignment, matrix);
            text.margins = margins;
            text.alignment = alignment;

            return text;
        }
    }

    exports.parseFormat = function parseFormat(formats, data, images, matrix) {
        let format = new FormattingTemplate(formats[data.renderType], data).solveAll();

        let sections = Object.keys(format);
        let output = {};
        let displayName = '';

        let multiPage = false;

        sections.forEach(sectionName => {
            let formatting = format[sectionName];

            if (sectionName === 'text') {
                displayName = format.text;
                displayName = displayName.text || displayName;

                return;
            }

            console.log(`parsing ${sectionName}`);

            if (sectionName === '__dynamic__') {
                output[sectionName] = {
                    dynamicRenderer: formatting,
                    data
                };
                return;
            } else
                output[sectionName] = parseSection(formatting, formats, data, images, matrix);
        });
        let objects = Object.values(output);

        objects = objects.map(object => {
            if (!object.margins) return object;

            return adjustMargins(object, output, data);
        });

        objects.filter(o => o instanceof GroupObject).forEach(groupObject => {
            Object.keys(groupObject.objects).forEach(key => {
                groupObject.objects[key].position.x += groupObject.position.x;
            });
        });

        let pages = [];
        let scrollSpeed = -1;

        multiPage = objects.filter(o => o.scrollObjects).length === 1;

        if (multiPage) {
            let scrollObject = objects.filter(o => o.scrollObjects)[0];
            let staticObjects = objects.filter(o => !o.scrollObjects);

            let scrollObjects = scrollObject.scrollObjects;
            scrollSpeed = scrollObject.scrollSpeed;

            scrollObjects.forEach(scrollObject => {
                if (scrollObject.rendered) {
                    pages.push(scrollObject.rendered.pages[0]);
                } else {
                    if (scrollObject.margins)
                        scrollObject = adjustMargins(scrollObject, output, data);

                    let totalObjects = [scrollObject, ...staticObjects];

                    let page = new RenderedOutputPage(totalObjects);
                    pages.push(page);
                }
            });
        } else {
            let page = new RenderedOutputPage(objects);
            pages.push(page);
        }

        let renderOutput = new RenderedOutput(pages, scrollSpeed, displayName);
        return renderOutput;
    }

    exports.drawPage = function drawPage(page, matrix) {
        page.objects.forEach(object => {
            drawObject(object, matrix);
        });
    }

    exports.drawObject = function drawObject(object, matrix) {
        if (object instanceof MultiFontTextObject) {
            object.text.forEach(section => {
                matrix.drawText(section);
            });
        } else if (object instanceof Image) {
            matrix.draw2DArray(object.data, object.position.x, object.position.y);
        } else if (object instanceof TextObject) {
            matrix.drawText(object);
        } else if (object.dynamicRenderer) {
            object.dynamicRenderer(matrix, object.data);
        } else if (object instanceof GroupObject) {
            let subObjects = Object.values(object.objects);

            subObjects.forEach(subObject => {
                drawObject(subObject, matrix);
            });
        }
    }

    exports.render = function render(renderOutput, matrix) {
        clearInterval(matrix.scrollInterval);

        if (!renderOutput) return;

        let currentPage = -1;
        let {scrollSpeed} = renderOutput;

        exports.renderPage = function renderPage() {
            currentPage++;
            if (currentPage >= renderOutput.pages.length) currentPage = 0;

            let page = renderOutput.pages[currentPage];

            matrix.clearRectangle(0, 0, matrix.width, matrix.height);
            matrix.onBeginDraw();
            drawPage(page, matrix);
            matrix.onEndDraw();
        }

        if (scrollSpeed > 0)
            matrix.scrollInterval = setInterval(renderPage, scrollSpeed);
        renderPage();
    }

}(typeof exports === 'undefined' ? window : exports));
