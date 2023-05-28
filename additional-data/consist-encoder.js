let encodings = [
    'Comeng',
    'Siemens',
    'Xtrapolis',
    'HCMT',
    'Hitachi',
    'N',
    'A',
    'VLocity',
    'Sprinter',
    null,
    null,
    null,
    null,
    null,
    'Unknown'
]

/*
 Integer 0000 0000
 First 4 bits to encode type
 Next 4 bits to encode length
*/

function encodeTrainType(size, type) {
    let typeEnum = encodings.indexOf(type)
    if (typeEnum === -1) typeEnum = 15

    let shiftedType = typeEnum << 4
    if (size > 15) throw new Error('Invalid size!')
    let combined = shiftedType | size
    return combined
}

function decodeTrainType(encoded) {
    let sizeMask = 0b00001111
    let typeMask = 0b11110000

    let size = encoded & sizeMask
    let typeEnum = (encoded & typeMask) >> 4

    return { size, type: encodings[typeEnum] }
}

module.exports = {
    encodeTrainType, decodeTrainType
}