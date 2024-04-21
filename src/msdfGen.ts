
export type Segment = Line | Quadratic
export type Path = [number, number][]

export type DistanceMap = {
  width: number,
  height: number,
  array: Float32Array
}
export type Uint8Image = {
  width: number,
  height: number,
  pitch: number,
  array: Uint8Array
}
export type Shape = {
  width: number,
  height: number
  lines: Segment[],
  planes: Segment[][]
}

export class Point {
  constructor(public x: number, public y: number) {}
  add(p: Point) { return new Point(this.x + p.x, this.y + p.y) }
  sub(p: Point) { return new Point(this.x - p.x, this.y - p.y) }
  mul(p: Point) { return new Point(this.x * p.x, this.y * p.y) }
  mulFactor(factor: number) { return new Point(this.x * factor, this.y * factor) }
  divFactor(factor: number) { return new Point(this.x / factor, this.y / factor) }
  dot(p: Point) { return this.x * p.x + this.y * p.y }
  addMul(p: Point, factor: number) { return new Point(this.x + p.x * factor, this.y + p.y * factor) }
  cross(p: Point) { return this.y * p.x - this.x * p.y }
  vectorLength() { return Math.sqrt(this.x*this.x + this.y*this.y) }
  distanceTo(p: Point) { return p.sub(this).vectorLength() }
  normalized() { return this.divFactor(this.vectorLength()) }
  
}
export class Line {
  constructor(public p0: Point, public p1: Point) {}
  getOffset() { return this.p1.sub(this.p0) }

  findNearestT(point: Point): number {
    const off = this.getOffset();
    return point.sub(this.p0).dot(off)
      / this.p1.sub(this.p0).dot(off)
  }
  evaluate(t: number) {
    const off = this.getOffset();
    return this.p0.addMul(off, t);
  }
  evaluateDelta(t: number) {
    return this.getOffset().normalized()
  }

  perpendicularDistanceTo(p: Point) {
    const off = this.getOffset();
    // TODO: handle divide by zero
    const t = p.sub(this.p0).dot(off)
      / this.p1.sub(this.p0).dot(off)
    const closest = this.p0.addMul(off, t);
    return closest.distanceTo(p);
  }
  closestPoint(p: Point) {
    // TODO: handle divide by zero
    const off = this.getOffset();
    let t = p.sub(this.p0).dot(off)
      / this.p1.sub(this.p0).dot(off)
    // t = Math.min(Math.max(t, 0), 1)
    return this.p0.addMul(off, t);
  }
  distanceTo(p: Point) {
    // TODO: handle divide by zero
    const off = this.getOffset();
    let t = p.sub(this.p0).dot(off)
      / this.p1.sub(this.p0).dot(off)
    t = Math.min(Math.max(t, 0), 1)
    const closest = this.p0.addMul(off, t);
    return closest.distanceTo(p);
  }
}
const distanceSquared = (p1: Point, p2: Point): number => {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

export class Quadratic {
  constructor(public p0: Point, public p1: Point, public p2: Point) {}

  // Evaluate the quadratic Bézier curve at a specific t value
  evaluate(t: number): Point {
    const invT = 1 - t;
    return new Point(
      invT * invT * this.p0.x + 2 * invT * t * this.p1.x + t * t * this.p2.x,
      invT * invT * this.p0.y + 2 * invT * t * this.p1.y + t * t * this.p2.y
    );
  }

  // Find the nearest t value on the curve for a given point
  findNearestT(point: Point): number {
    let t = 0;
    let minDist = Infinity;
    let bestT = 0;
    const iterations = 100; // Increase for better accuracy

    for (let i = 0; i <= iterations; i++) {
      t = i / iterations;
      const curvePoint = this.evaluate(t);
      const dist = distanceSquared(curvePoint, point);
      if (dist < minDist) {
        minDist = dist;
        bestT = t;
      }
    }

    return bestT;
  }

  evaluateDelta(t: number): Point {
    // The derivative B'(t) = 2(1 - t)(p1 - p0) + 2t(p2 - p1)
    return this.p1.sub(this.p0).mulFactor(2 * (1 - t)).add(
      this.p2.sub(this.p1).mulFactor(2 * t)
    ).normalized();
  }
}

export const newShape = (width: number, height: number) => {
  const shape: Shape = {
    width: width,
    height: height,
    lines: [],
    planes: [[],[],[]]
  }
  return shape;
}

export const addPath = (shape: Shape, path: Path) => {
  for (let i = 0; i < path.length - 1; i++) {
    const line = new Line(
      new Point(path[i + 0][0], path[i + 0][1]),
      new Point(path[i + 1][0], path[i + 1][1]))
    shape.lines.push(line)
  }

}
export const splitPlanes = (shape: Shape) => {
  shape.planes[0].push(...shape.lines.filter((x, i) => i === 0 || i % 2 === 0));
  shape.planes[1].push(...shape.lines.filter((x, i) => i === 0 || i % 2 !== 0));
  shape.planes[2].push(...shape.lines.slice(1));
}


export const newDistanceMap = (width: number, height: number) => {

  const distanceMap: DistanceMap = {
    width,
    height,
    array: new Float32Array(width * height)
  }
  return distanceMap
}
// Encapsulates closest point, closest perpendicular point and orthoganality algorithms,
// And exposes data for use in visualisations
export const segmentDistanceSelector = (segment: Segment) => {

  const obj = {
    segment,
    perpendicular: false,
    point: undefined! as Point,
    t: 0,
    sign: 1,
    distance: 0,
    closest: undefined! as Point,
    setPerpendicular: () => {
      obj.perpendicular = true
      return obj
    },
    setDistanceFromPoint: (point: Point) => {
      obj.point = point

      obj.t = segment.findNearestT(point)
      
      if (!obj.perpendicular) 
        obj.t = Math.min(Math.max(obj.t, 0), 1)
      
      obj.closest = segment.evaluate(obj.t);
      obj.distance = obj.closest.distanceTo(point);

      const pd = point.sub(obj.closest);
      obj.sign = segment.evaluateDelta(obj.t).cross(pd) > 0 ? 1 : -1;

      return obj;
    },
    get orthoganality() {
      const o = obj.point.sub(obj.closest).normalized()
      return Math.abs(segment.evaluateDelta(obj.t).cross(o))
    }
  }

  return obj;
}

export const floatEq = (a, b) => Math.abs(a - b) < 0.001
export const minBy = <T>(list: T[], compare: (a: T, b: T) => number) => {
  let min: T = null!
  for (let i = 0; i < list.length; i++) {
    if (!min) min = list[i]
    else if (compare(min, list[i]) < 0) min = list[i]
  }
  return min
}

export const fillPlane = (distanceMap: DistanceMap, shape: Shape, plane: Segment[]) => {
  if (!plane.length) throw new Error("Plane is empty")
  if (plane.length === 1) throw new Error("Plane has one shape. Not implemented yet")
  const scaleX = shape.width / distanceMap.width
  const scaleY = shape.height / distanceMap.height

  const closests = plane.map(line => segmentDistanceSelector(line))
  
  for (let j = 0; j < distanceMap.height; j++) {
    for (let i = 0; i < distanceMap.width; i++) {
      // TODO: offset by 0.5
      const off = 0.5
      // flip?
      const point = new Point((i + off) * scaleX, ((j + off)) * scaleY)

      closests.forEach(x => x.setDistanceFromPoint(point))

      const min = minBy(closests, (a, b) => {
        if (floatEq(a.distance, b.distance)) 
          return a.orthoganality - b.orthoganality // Maximise orthgonality
        return b.distance - a.distance
      })

      const segment = min.segment;
      let d = segmentDistanceSelector(segment)
        .setPerpendicular()
        .setDistanceFromPoint(point)

      const distance = d.distance * d.sign

      distanceMap.array[j * distanceMap.width + i] = distance
    }
  }
  return distanceMap;
}



export const fillRgbDistanceMap = (outImage: Uint8Image, distanceMap: DistanceMap, colorId: number, config: { maxRange: number }) => {
  distanceMap.array.forEach((distance, i) => {
    // Range -maxRange..maxRange to -1..1
    let s = distance / (2 * config.maxRange) + 0.5
    s = Math.min(Math.max(s, 0), 1);
    const r = Math.floor((1 - s) * 255);
    outImage.array[i * outImage.pitch + colorId] = r;
  });
}

export const fillRgbDebugDistanceMap = (outImage: Uint8Image, distanceMap: DistanceMap, colorId: number) => {

  distanceMap.array.forEach((distance, i) => {
    const d = distance / 1 // Range -1 to 1
    const r =  Math.floor((1 - Math.min(Math.max( d, 0), 1)) * 255);
    const gb = Math.floor((1 - Math.min(Math.max(-d, 0), 1)) * 255);
    outImage.array[i * outImage.pitch + 0] = colorId == 0 ? r : gb;
    outImage.array[i * outImage.pitch + 1] = colorId == 1 ? r : gb;
    outImage.array[i * outImage.pitch + 2] = colorId == 2 ? r : gb;
  });
}

// 


export const createTga = (image: Uint8Image) => {

  // http://www.paulbourke.net/dataformats/tga/
  const header = new Uint8Array(18)
  header[2] = 2;
  header[12] = 255 & image.width;
  header[13] = 255 & (image.width >> 8);
  header[14] = 255 & image.height;
  header[15] = 255 & (image.height >> 8);
  header[16] = 24;
  header[17] = 32;

  const array = new Uint8Array(image.width * image.height * 3)
  for (let i = 0; i < image.width * image.height; i++) {
    const dest = i * 3
    array[dest+2] = image.array[i * image.pitch+0];
    array[dest+1] = image.array[i * image.pitch+1];
    array[dest+0] = image.array[i * image.pitch+2];
  }

  const mergedArray = new Uint8Array(header.length + array.length);
  mergedArray.set(header);
  mergedArray.set(array, header.length);

  return mergedArray;
}

const writePng = (input: Uint8Image, filename: string) => {
  new Jimp(input.width, input.height, (err, image) => {
    if (err) throw err;

    for (let j = 0; j < input.height; j++) {
      for (let i = 0; i < input.width; i++) {
        const source = (i + j * input.width) * 3;
        const rgba = Jimp.rgbaToInt(
          (input.array[source + 0]),
          (input.array[source + 1]),
          (input.array[source + 2]),
          255);
        image.setPixelColor(rgba, i, j);
      }
  
    }

    image.write(filename, (err) => {
      if (err) throw err;
    });
  });
}

export const newImage = (width: number, height: number, pitch: number) => {
  return <Uint8Image>{
    width: width,
    height: height,
    pitch: pitch,
    array: new Uint8Array(width * height * pitch)
  }
}

const debugPath = () => {
  const path = [[1, 1], [14, 2], [13, 15], [2, 14], [1, 1]] as Path;
  addPath(shape, path);

  {
    const path = [[4 + 0, 4 + 0], [4 + 2, 4 + 0], [4 + 2, 4 + 2], [4 + 0, 4 + 2], [4 + 0, 4 + 0]] as Path
    path.reverse()
    addPath(shape, path);
  }

}


export const pathFromGlyphPath = (shape: Shape, padding: number, glyph) => {
  const path = glyph.path;
  const bounds = path.getBoundingBox()
  const width = bounds.x2 - bounds.x1
  const height = bounds.y2 - bounds.y1
  // shape.width = 16;
  // shape.height = 16;

  const min = new Point(bounds.x1, bounds.y1)
  // const scale = new Point((shape.width - padding*2) / (width), (shape.height - padding*2) / (height))
  const scale = new Point(1,1)
  // console.log(min, scale)
  
  const doScale = (p: Point) => p.sub(min).mul(scale).add(new Point(padding, padding))
  const scaled = (x: number, y: number) => doScale(new Point(x, y))
  
  const line = (start, end) => {
    let s = scaled(start.x, start.y)
    let e = scaled(end.x, end.y)
    if (s.sub(e).vectorLength() < 0.0001) return
    
    const line = new Line(s, e) // reversed??
    shape.lines.push(line)
  }
  const quadratic = (start, middle, end) => {
    let s = scaled(start.x, start.y)
    let m = scaled(middle.x, middle.y)
    let e = scaled(end.x, end.y)
    if (s.sub(e).vectorLength() < 0.0001) return
    
    const quad = new Quadratic(s, m, e) // reversed??
    shape.lines.push(quad)
  }
  
  let cursor = {x:0, y: 0}
  let pathBegin
  path.commands.forEach(command => {
    if (command.type === 'M') {
      cursor = command;
      if (!pathBegin) pathBegin = command
    } else if (command.type === 'L') {
      line(cursor, command)
      cursor = command;
    } else if (command.type === 'Q') {
      quadratic(cursor, {x: command.x1, y: command.y1}, command)
      cursor = command;
    } else if (command.type === 'Z') {
      line(cursor, pathBegin)
      pathBegin = null
    } else throw new Error("Not implemented")
  })
}



// const fontBuffer = await Bun.file("src/assets/Roboto-Regular.ttf").arrayBuffer();
// const font = opentype.parse(fontBuffer, null);
// console.log({...font.charToGlyph('d')})
// console.log(font.charToGlyph('d').path)
// pathFromGlyphPath(shape, font.charToGlyph('d'))
// // console.log(shape.lines.map(l => [[l.p0.x, l.p0.y], [l.p1.x, l.p1.y]]))

// const path = <[number, number][][]>[
//   [
//     [ 7.96232508073197, 9.889094269870611 ], [ 4.390742734122712, 15 ]
//   ], [
//     [ 11.579117330462864, 15 ], [ 7.96232508073197, 9.889094269870611 ]
//   ], [
//     [ 14.834230355220667, 15 ], [ 11.579117330462864, 15 ]
//   ], [
//     [ 9.4994617868676, 8.077634011090574 ], [ 14.834230355220667, 15 ]
//   ], [
//     [ 15, 1 ], [ 9.4994617868676, 8.077634011090574 ]
//   ], [
//     [ 11.77502691065662, 1 ], [ 15, 1 ]
//   ], [
//     [ 8.007534983853606, 6.240295748613678 ], [ 11.77502691065662, 1 ]
//   ], [
//     [ 4.240043057050592, 1 ], [ 8.007534983853606, 6.240295748613678 ]
//   ], [
//     [ 1, 1 ], [ 4.240043057050592, 1 ]
//   ], [
//     [ 6.5005382131324, 8.077634011090574 ], [ 1, 1 ]
//   ], [
//     [ 1.1657696447793326, 15 ], [ 6.5005382131324, 8.077634011090574 ]
//   ], [
//     [ 4.390742734122712, 15 ], [ 1.1657696447793326, 15 ]
//   ], [
//     [ 4.390742734122712, 15 ], [ 4.390742734122712, 15 ]
//   ]
// ]
// // addPath(shape, path);
// // path.forEach(l => {
// //   const line = new Line(
// //     new Point(l[0][0], l[0][1]),
// //     new Point(l[1][0], l[1][1]))
// //   shape.lines.push(line)
// // })
// // shape.width = 16;
// // shape.height = 16;

// splitPlanes(shape)
// // const p = x.getPath();


// const image: Uint8Image = newImage(distanceMap.width, distanceMap.height);

// const config = { maxRange: 1 }

// {
//   fillPlane(distanceMap, shape, shape.planes[0])

//   const debug = newImage(distanceMap.width, distanceMap.height);
//   fillRgbDebugDistanceMap(debug, distanceMap, 0);
//   Bun.write('thing_debug_r.tga', createTga(debug))

//   fillRgbDistanceMap(image, distanceMap, 0, config)
//   Bun.write('thing_r.tga', createTga(image))
// }

// {
//   fillPlane(distanceMap, shape, shape.planes[1])

//   const debug = newImage(distanceMap.width, distanceMap.height);
//   fillRgbDebugDistanceMap(debug, distanceMap, 1);
//   Bun.write('thing_debug_g.tga', createTga(debug))

//   fillRgbDistanceMap(image, distanceMap, 1, config)
//   Bun.write('thing_g.tga', createTga(image))
// }

// {
//   fillPlane(distanceMap, shape, shape.planes[2])

//   const debug = newImage(distanceMap.width, distanceMap.height);
//   fillRgbDebugDistanceMap(debug, distanceMap, 2);
//   Bun.write('thing_debug_b.tga', createTga(debug))

//   fillRgbDistanceMap(image, distanceMap, 2, config)
//   Bun.write('thing_b.tga', createTga(image))
// }

// writePng(image, 'src/assets/image.png')