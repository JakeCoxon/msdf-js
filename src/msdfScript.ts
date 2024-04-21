
import fs from 'fs'
import Jimp from 'jimp'
import opentype from 'opentype.js'

import { createTga, fillPlane, fillRgbDebugDistanceMap, fillRgbDistanceMap, newDistanceMap, newImage, newShape, pathFromGlyphPath, splitPlanes } from "./msdfGen";
import createPack from 'bin-pack'
import cliProgress from 'cli-progress'

const filepath = process.argv[2]

const splitLast = (str: string, separator: string) => {
  const right = str.split(separator).pop()!
  const left  = str.substring(0, str.length - right.length - separator.length)
  return [left, right]
}

const [dir, file] = splitLast(filepath, '/')
const [name, ext] = splitLast(file, '.')

const fileConfig = {
  dir, file, name, ext,
  outJsonFile: `${dir || '.'}/${name}.json`,
  outPngFile: `${dir || '.'}/${name}.png`
}


const fontBuffer = await Bun.file(filepath).arrayBuffer();

const font = opentype.parse(fontBuffer, null);
const config = { maxRange: 1 }

// console.log(font)

const chars = [...new Array(128)].map((x, i) => String.fromCharCode(i)).filter(Boolean)
// const chars = " abcdefghijklmnopqstuvwxyzABCDEFGHIJKLMNOPQSTUVWXYZ0123456789,.<>()[]".split("")
// console.log(chars)

const bins: any[] = [];

const fontSize = 100
const fontScale = fontSize / font.unitsPerEm;

const os2 = font.tables.os2;
const baseline = font.tables.os2.sTypoAscender * fontScale;
const padding = 10; // TODO: place this somewhere

chars.forEach((char, index) => {
  const glyph = font.charToGlyph(char)
  if (!glyph.index) { return }
  if (!glyph.path.commands.length) { return }
  // console.log(char)
  // console.log(glyph.path)
  let width = glyph.xMax - glyph.xMin
  let height = glyph.yMax - glyph.yMin
  // const scale = 64 / Math.max(width, height)
  width *= fontScale
  height *= fontScale
  width += padding*2
  height += padding*2
  const shape = newShape(width, height);
  const path = glyph.getPath(0, fontSize, fontSize)
  const bounds = path.getBoundingBox()

  const fontData = {
    char: String(char),
    width: width,
    height: height,
    xoffset: (bounds.x1) - padding,
    yoffset: (bounds.y1) + padding,
    xadvance: glyph.advanceWidth * fontScale,
  }
  
  // console.log()
  pathFromGlyphPath(shape, padding, {...glyph, path});
  // throw new Error()

  const getFontData = (item) => {
    return {...fontData, x: item.x, y: item.y}
  }

  const bin = { glyph, width, height, shape, fontData, getFontData }
  bins.push(bin);
});

const REGEX = /-?(?:\d*\.)?\d+|[a-z]/gi

// const pathString = `M40.4645 50H5V45H42.5355L74.0355 76.5H125.5V81.5H71.9645L40.4645 50Z`
// const matches = pathString.match(REGEX)

// const commands = (() => {
//   if (!matches) return []
//   const commands: any[] = []
//   let previous;
//   for (let i = 0; i < matches.length;) {
//     const match = (x) => { if (matches[i] === x) { previous = matches[i]; i++; return true; } return false }
//     const consume = () => { previous = matches[i]; i++; return previous }
//     const number = () => Number(consume())
//     if (match('M')) {
//       commands.push({ type: previous, x: number(), y: number() })
//     } else if (match("H")) {
//       commands.push({ type: "L", x: number(), y: commands[commands.length - 1]!.y })
//     } else if (match("V")) {
//       commands.push({ type: "L", x: commands[commands.length - 1]!.x, y: number() })
//     } else if (match("L")) {
//       commands.push({ type: previous, x: number(), y: number() })
//     } else if (match("Q")) {
//       commands.push({ type: previous, x1: number(), y1: number(), x: number(), y: number() })
//     } else if (match("Z")) {
//       commands.push({ type: previous })
//     } else {
//       throw new Error(`Not implemented ${matches[i]}`)
//     }
//   }
//   return commands
// })();
// console.log(matches)
// console.log(commands)

// const shape = newShape(128, 128);
// pathFromGlyphPath(shape, {
//   xMin: 0, xMax: 128,
//   yMin: 0, yMax: 128,
//   path: {
//     commands: commands
//   }
// })
// bins.push({ shape, width: 48, height: 48 })

const outputPack = createPack(bins)
// console.log(outputPack)

if (!outputPack.items.length) throw new Error()

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

bar1.start(outputPack.items.length, 0)


outputPack.items.forEach((rect, index) => {
  
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)

  const source = newImage(width, height, 3);
  const distanceMap = newDistanceMap(width, height)

  const shape = rect.item.shape;

  splitPlanes(shape)

  fillPlane(distanceMap, shape, shape.planes[0])
  fillRgbDistanceMap(source, distanceMap, 0, config)
  {
    // const debug = newImage(distanceMap.width, distanceMap.height, 3);
    // fillRgbDebugDistanceMap(debug, distanceMap, 0);
    // Bun.write('thing_debug_r.tga', createTga(debug))
  }

  fillPlane(distanceMap, shape, shape.planes[1])
  fillRgbDistanceMap(source, distanceMap, 1, config)

  fillPlane(distanceMap, shape, shape.planes[2])
  fillRgbDistanceMap(source, distanceMap, 2, config)
 
  rect.item.image = new Jimp(width, height, (err, image) => {

    for (let i = 1; i < width - 2; i++) {

      for (let j = 1; j < height - 2; j++) {

        const off = (i + j * source.width) * source.pitch;
        const rgba = Jimp.rgbaToInt(
          (source.array[off + 0]),
          (source.array[off + 1]),
          (source.array[off + 2]),
          255);
        image.setPixelColor(rgba, i, j)
      }
    }
  })

  bar1.update(index + 1)
})

bar1.stop();
// const data = []

// new Jimp(Buffer.from(data))

new Jimp(Math.ceil(outputPack.width), Math.ceil(outputPack.height), (err, image) => {
  if (err) throw err;

  outputPack.items.forEach(rect => {
    image.blit(rect.item.image, rect.x, rect.y)
  });
  // for (let j = 0; j < input.height; j++) {
  //   for (let i = 0; i < input.width; i++) {
  //     const source = (i + j * input.width) * 3;
  //     const rgba = Jimp.rgbaToInt(
  //       (input.array[source + 0]),
  //       (input.array[source + 1]),
  //       (input.array[source + 2]),
  //       255);
  //     image.setPixelColor(rgba, i, j);
  //   }

  // }

  image.write(fileConfig.outPngFile, (err) => {
    if (err) throw err;
  });
  console.log("Wrote", fileConfig.outPngFile)
});


const fontOutput = {
  chars: outputPack.items.map(x => x.item.getFontData(x)).filter(Boolean),
  info: {
    // face: fontface,
    size: fontSize,
    bold: 0,
    italic: 0,
    unicode: 1,
    stretchH: 100,
    smooth: 1,
    aa: 1,
    padding: [padding, padding],
    spacing: 0,
    outline: 0
  },
  common: {
    lineHeight: (os2.sTypoAscender - os2.sTypoDescender + os2.sTypoLineGap) * (fontSize / font.unitsPerEm),
    base: baseline,
    scaleW: outputPack.width,
    scaleH: outputPack.height,
    // pages: packer.bins.length,
  },
}

// Bun.write(fileConfig.outJsonFile, JSON.stringify(fontOutput))
fs.writeFileSync(fileConfig.outJsonFile, JSON.stringify(fontOutput))
console.log("Wrote", fileConfig.outJsonFile)
// console.log(fontOutput)

// chars.split("").forEach((char, index) => {
//   const shape = newShape(16, 16);

//   const glyph = font.charToGlyph(char)

//   pathFromGlyphPath(shape, glyph)

//   splitPlanes(shape)

//   console.log(shape)
  
  
//   fillPlane(distanceMap, shape, shape.planes[0])
//   fillRgbDistanceMap(image, distanceMap, 0, config)

//   fillPlane(distanceMap, shape, shape.planes[1])
//   fillRgbDistanceMap(image, distanceMap, 1, config)

//   fillPlane(distanceMap, shape, shape.planes[2])
//   fillRgbDistanceMap(image, distanceMap, 2, config)
// });