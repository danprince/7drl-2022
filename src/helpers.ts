import { Array2D, Direction, Point, Vector } from "silmarils";
import { Glyph } from "./common";

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

type DijkstraCost<T> = (current: T, next: T) => number;
type DijkstraNeighbours<T> = (current: T) => T[];

export class DijkstraMap {
  costSoFar: Array2D.Array2D<number>;
  cameFrom: Array2D.Array2D<Point.Point | undefined>;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly start: Point.Point,
    private getCost: DijkstraCost<Point.Point>,
    private getNeighbours: DijkstraNeighbours<Point.Point> = Point.vonNeumannNeighbours,
  ) {
    this.costSoFar = Array2D.create<number>(width, height, Infinity);
    this.cameFrom = Array2D.create<Point.Point | undefined>(width, height);
    this.update();
  }

  update() {
    let { get, set, create } = Array2D;
    let { start, width, height, getCost } = this;
    let frontier: Point.Point[] = [start];
    let costSoFar = create<number>(width, height, Infinity);
    let cameFrom = create<Point.Point | undefined>(width, height);
    set(costSoFar, start.x, start.y, 0);

    while (frontier.length) {
      let current = frontier.pop()!;

      for (let next of this.getNeighbours(current)) {
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

    this.costSoFar = costSoFar;
    this.cameFrom = cameFrom;
  }

  debug() {
    console.log(
      Array2D.toString(Array2D.map(this.costSoFar, (cost) => isFinite(cost) ? String(cost % 10) : "∞"))
    );
  }

  shortestPath(end: Point.Point) {
    let path: Point.Point[] = [];
    let prev: Point.Point | undefined = end;

    while (prev) {
      path.unshift(Point.clone(prev));
      prev = Array2D.get(this.cameFrom, prev.x, prev.y);
    }

    if (path.length === 1) {
      return [];
    } else {
      return path;
    }
  }

  distanceTo(point: Point.Point) {
    return Array2D.get(this.costSoFar, point.x, point.y)!;
  }

  finiteDistanceTo(point: Point.Point) {
    let distance = this.distanceTo(point);
    return isFinite(distance) ? distance : 0;
  }

  longestPathLength() {
    let distances = this.costSoFar.data.filter(isFinite)
    return Math.max(...distances);
  }
}

export function dijkstra(
  width: number,
  height: number,
  start: Point.Point,
  getCost: DijkstraCost<Point.Point>,
  getNeighbours?: DijkstraNeighbours<Point.Point>,
): DijkstraMap {
  return new DijkstraMap(width, height, start, getCost, getNeighbours);
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
