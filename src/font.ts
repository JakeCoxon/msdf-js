export type Point = [number, number];
export type Rect = [number, number, number, number]

export type FontGlyphData = {
  id: number,
  char: string,
  x: number, y: number,
  width: number, height: number, // texture size including padding
  xadvance: number, xoffset: number, yoffset: number, subRect: Rect
}
export type FontData = {
  common: { scaleW: number, scaleH: number, base: number, lineHeight: number }
  info: { size: number, padding: Rect },
  chars: FontGlyphData[]
}
export type MsdfFont = {
  texture: string;
  data: FontData;
  getGlyph: (codepoint: string) => FontGlyphData
}
export type FontLayout = {
  font: MsdfFont,
  rects: {
    glyph: FontGlyphData,
    rect: Rect
    textureRect: Rect
  }[]
  extents: Rect
}


export const createMsdfFont = ({ texture, data }: { texture: string, data: FontData }): MsdfFont => {

  const byChar = Object.fromEntries(data.chars.map(char => {

    const subRect = [
      char.x / data.common.scaleW,
      char.y / data.common.scaleH,
      (char.x + char.width) / data.common.scaleW,
      (char.y + char.height) / data.common.scaleH,
    ] as Rect
    char.subRect = subRect;

    return [char.char, char]
  }))

  return {
    texture,
    data,
    getGlyph: (codepoint) => byChar[codepoint]
  }
}

export const createLayout = (font: MsdfFont, string: string): FontLayout => {

  const extents = { x1: 0, y1: 0, x2: 0, y2: 0 }
  // const top = font.data.common.base + font.data.common.lineHeight - font.data.info.size;
  const top = font.data.common.lineHeight + font.data.info.size - font.data.common.base
  const padding = font.data.info.padding[0] // Assume padding is the same
  let xoffset = 0;
  const rects = [...string].map(codepoint => {
    const glyph = font.getGlyph(codepoint)
    // yoffset is top-bottom from a fixed top position
    const x = xoffset + glyph.xoffset + padding
    const y = top - glyph.height - glyph.yoffset
    const textureRect = [x - padding, y - padding, glyph.width, glyph.height] as Rect
    const rect = [x, y, glyph.width - padding*2, glyph.height - padding*2] as Rect
    const item = { glyph, rect, textureRect }
    extents.x1 = Math.min(extents.x1, rect[0])
    extents.y1 = Math.min(extents.y1, rect[1])
    extents.x2 = Math.max(extents.x2, rect[0] + rect[2])
    extents.y2 = Math.max(extents.y2, rect[1] + rect[3])
    xoffset += glyph.xadvance
    return item;
  })
  return {
    font,
    rects, extents: [extents.x1, extents.y1, extents.x2 - extents.x1, extents.y2 - extents.y1]
  }
}