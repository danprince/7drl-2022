import { Array2D, Direction, Point, Vector } from "silmarils";
import { Chars } from "./chars";
import { Glyph } from "./terminal";

export type Constructor<T> = { new(...args: any[]): T };
export type OneOrMore<T> = [item: T, ...items: T[]];

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = err => reject(err);
  });
}

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function clamp(min: number, val: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

export function delayAnimationFrame(delay: number = 0) {
  let start = performance.now();

  return new Promise<void>((resolve, reject) => {
    function poll(now: number) {
      let elapsed = now - start;
      if (elapsed >= delay) {
        resolve();
      } else {
        requestAnimationFrame(poll);
      }
    }
    requestAnimationFrame(poll);
  });
}

export const DIRECTION_CHARS: {
  [K in Direction.Direction]: string
} = {
  [Direction.NORTH]: Chars.North,
  [Direction.SOUTH]: Chars.South,
  [Direction.WEST]: Chars.West,
  [Direction.EAST]: Chars.East,
  [Direction.NORTH_EAST]: Chars.NorthEast,
  [Direction.SOUTH_EAST]: Chars.SouthEast,
  [Direction.NORTH_WEST]: Chars.NorthWest,
  [Direction.SOUTH_WEST]: Chars.SouthWest,
};

export function getDirectionChar(direction: Direction.Direction): string {
  return DIRECTION_CHARS[direction];
}

export function directionToGridVector(direction: Direction.Direction) {
  let vec = Direction.toVector(direction);

  // Convert diagonal unit vectors to grid units
  vec[0] = Math.round(vec[0]);
  vec[1] = Math.round(vec[1]);

  return vec;
}

export function percentToString(num: number): string {
  return Math.floor(num * 100) + "%";
}

export function glyphToString(glyph: Glyph) {
  if (glyph.bg == null) {
    return `{${glyph.fg}}${glyph.char}{/}`;
  } else {
    return `{${glyph.fg}:${glyph.bg}}${glyph.char}{/}`;
  }
}

export function getDirectionBetween(p1: Point.Point, p2: Point.Point): Direction.Direction {
  let vec = Vector.fromPoints(p1, p2);
  return Direction.fromVector(vec);
}

export interface DijkstraMap {
  costSoFar: Array2D.Array2D<number>;
  cameFrom: Array2D.Array2D<Point.Point | undefined>;
  pathTo(point: Point.Point): Point.Point[];
  distanceTo(point: Point.Point): number;
  finiteDistanceTo(point: Point.Point): number;
}

type DijkstraCost<T> = (current: T, next: T) => number;
type DijkstraNeighbours<T> = (current: T) => T[];

export function dijkstra(
  width: number,
  height: number,
  start: Point.Point,
  getCost: DijkstraCost<Point.Point>,
  getNeighbours: DijkstraNeighbours<Point.Point> = Point.vonNeumannNeighbours,
): DijkstraMap {
  let { get, set, create } = Array2D;
  let frontier: Point.Point[] = [start];
  let costSoFar = create<number>(width, height, Infinity);
  let cameFrom = create<Point.Point | undefined>(width, height);
  set(costSoFar, start.x, start.y, 0);

  while (frontier.length) {
    let current = frontier.pop()!;

    for (let next of getNeighbours(current)) {
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) {
        continue;
      }

      let currentCost = get(costSoFar, current.x, current.y)!;
      let extraCost = getCost(current, next);
      let newCost = currentCost + extraCost;
      let nextCost = get(costSoFar, next.x, next.y)!;

      if (newCost < nextCost) {
        set(costSoFar, next.x, next.y, newCost);
        set(cameFrom, next.x, next.y, current);
        frontier.push(next);
      }
    }
  }

  function pathTo(end: Point.Point): Point.Point[] {
    let path: Point.Point[] = [];
    let prev: Point.Point | undefined = end;

    while (prev) {
      path.unshift(Point.clone(prev));
      prev = Array2D.get(cameFrom, prev.x, prev.y);
    }

    if (path.length === 1) {
      return [];
    } else {
      return path;
    }
  }

  function distanceTo(point: Point.Point): number {
    return Array2D.get(costSoFar, point.x, point.y)!;
  }

  function finiteDistanceTo(point: Point.Point): number {
    let distance = distanceTo(point);
    return isFinite(distance) ? distance : 0;
  }

  return {
    costSoFar,
    cameFrom,
    pathTo,
    distanceTo,
    finiteDistanceTo,
  };
}

export class PointSet {
  private set = new Set<`${number}:${number}`>();

  add({ x, y }: Point.Point): this {
    this.set.add(`${x}:${y}`);
    return this;
  }

  has({ x, y }: Point.Point): boolean {
    return this.set.has(`${x}:${y}`);
  }

  delete({ x, y }: Point.Point): boolean {
    return this.set.delete(`${x}:${y}`);
  }
}

export function maxBy<T>(items: T[], getScore: (item: T) => number): T {
  let best = items[0];
  let max = -Infinity;

  for (let item of items) {
    let score = getScore(item);

    if (score > max) {
      max = score;
      best = item;
    }
  }

  return best;
}

export function minBy<T>(items: T[], getScore: (item: T) => number): T {
  let best = items[0];
  let min = Infinity;

  for (let item of items) {
    let score = getScore(item);

    if (score < min) {
      min = score;
      best = item;
    }
  }

  return best;
}

// TODO: Stamp should probably be array2d then they can be rotated
export function createStamp(pattern: string): Point.Point[] {
  let cells = Array2D.fromString(pattern);
  let origin: Point.Point = Point.ORIGIN;

  for (let x = 0; x < cells.width; x++) {
    for (let y = 0; y < cells.height; y++) {
      if (Array2D.get(cells, x, y) === "@") {
        origin = { x, y };
        break;
      }
    }
  }

  let center = Point.floored({ x: cells.width / 2, y: cells.height / 2 });
  let stamp: Point.Point[] = [];

  for (let x = 0; x < cells.width; x++) {
    for (let y = 0; y < cells.height; y++) {
      if (Array2D.get(cells, x, y) !== ".") {
        stamp.push({ x: x - center.x, y: y - center.y });
      }
    }
  }

  return stamp;
}