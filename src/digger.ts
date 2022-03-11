import { PRNG, Point, Direction, Array2D, Raster } from "silmarils";
import { directionToGridVector } from "./helpers";

export enum Marker {
  Floor = 0,
  Wall = 1,
}

export type CellularAutomataRules = [
  born: number[],
  survive: number[]
];

export enum Symmetry {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
  Both = 3,
}

interface Tunneler {
  dir: Direction.Direction,
  pos: Point.Point,
  spade: number,
}

export class Digger {
  grid: Uint8Array;
  width: number;
  height: number;
  rng: PRNG.RNG;
  outOfBoundsMarker: Marker;

  constructor(width: number, height: number, seed: number, outOfBoundsMarker = Marker.Wall) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.rng = PRNG.generator(seed);
    this.outOfBoundsMarker = outOfBoundsMarker;
  }

  debug() {
    let str = "";
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let marker = this.grid[x + y * this.width];
        str += marker === Marker.Floor ? "." : "#";
      }
      str += "\n";
    }
    console.log(str);
  }

  reset() {
    this.grid.fill(0);
  }

  get(x: number, y: number): Marker {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      return this.grid[x + y * this.width];
    } else {
      return this.outOfBoundsMarker;
    }
  }

  set(x: number, y: number, marker: Marker) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.grid[x + y * this.width] = marker;
    }
  }

  getRandomPoint(): Point.Point {
    return Point.from(
      PRNG.int(this.rng, 0, this.width),
      PRNG.int(this.rng, 0, this.height),
    );
  }

  fill(marker: Marker) {
    this.grid.fill(marker);
    return this;
  }

  circle(x: number, y: number, radius: number, marker = Marker.Floor) {
    for (let point of Raster.fillCircle({ x, y, radius })) {
      this.set(point.x, point.y, marker);
    }
  }

  invert() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let index = x + y * this.width;
        this.grid[index] = this.grid[index] === Marker.Floor
          ? Marker.Wall
          : Marker.Floor;
      }
    }
    return this;
  }

  noise(percent: number = 0.5) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[x + y * this.width] = PRNG.chance(this.rng, percent)
          ? Marker.Wall
          : Marker.Floor;
      }
    }
    return this;
  }

  radialNoise(percent: number = 0.5) {
    let center = Point.from(this.width / 2 | 0, this.height / 2 | 0);
    let maxDist = Point.chebyshev(center, Point.ORIGIN);
    let additiveChance = percent * 2 - 1;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let dist = Point.distance(center, { x, y });
        let bias = dist / maxDist + additiveChance;
        this.grid[x + y * this.width] = PRNG.chance(this.rng, bias)
          ? Marker.Wall
          : Marker.Floor;
      }
    }

    return this;
  }

  addBitPattern(
    pattern: number,
    marker: Marker = Marker.Wall,
    x = Math.floor(this.width / 2),
    y = Math.floor(this.height / 2)
  ) {
    for (let i = 0; i < 9; i++) {
      let bit = pattern & (1 << i);
      if (bit === 0) continue;
      let bx = x + (i % 3 | 0) - 1;
      let by = y + (i / 3 | 0) - 1;
      this.set(bx, by, marker);
    }

    return this;
  }

  createMaze() {
    this.fill(Marker.Wall);

    let start = this.getRandomPoint();
    let stack = [start];
    let seen = new Set<string>();

    const countAdjacentWalls = (p: Point.Point): number => {
      return Point
        .mooreNeighbours(p)
        .filter(pos => this.get(pos.x, pos.y))
        .length;
    }

    while (stack.length) {
      let pos = stack.pop()!;
      let score = countAdjacentWalls(pos);
      if (score < 5) continue;

      this.set(pos.x, pos.y, Marker.Floor);

      let neighbours = Point.vonNeumannNeighbours(pos);
      PRNG.shuffle(this.rng, neighbours);

      for (let neighbour of neighbours) {
        let key = `${neighbour.x}:${neighbour.y}`;
        let score = countAdjacentWalls(neighbour);
        if (score >= 5 && !seen.has(key)) {
          stack.push(neighbour);
          seen.add(key);
        }
      }
    }

    return this;
  }

  tunnels({
    start = this.getRandomPoint(),
    iterations = 10,
    spades = [0b000_010_000],
    spawnChance = 0,
    deathChance = 0,
    turnChance = 0.1,
    mutationChance = 0,
    directions = Direction.CARDINAL_DIRECTIONS,
    symmetry = Symmetry.None,
    maxTunnelers = 10,
  }: {
    start?: Point.Point;
    iterations?: number;
    spades?: number[];
    spawnChance?: number;
    deathChance?: number;
    turnChance?: number;
    mutationChance?: number;
    directions?: Direction.Direction[];
    symmetry?: Symmetry;
    maxTunnelers?: number;
  }) {
    let tunnelers: Tunneler[] = [{
      pos: start,
      dir: PRNG.element(this.rng, directions),
      spade: PRNG.element(this.rng, spades),
    }];

    const dig = (x: number, y: number) => {
      let marker = Marker.Floor;
      this.set(x, y, marker);
      if (symmetry & Symmetry.Vertical) this.set(this.width - 1 - x, y, marker);
      if (symmetry & Symmetry.Horizontal) this.set(x, this.height - 1 - y, marker);
      if (symmetry === Symmetry.Both) this.set(this.width - 1 - x, this.height - 1 - y, marker);
    };

    for (let i = 0; i < iterations; i++) {
      for (let tunneler of tunnelers) {
        let { x, y } = tunneler.pos;
        let canSpawn = tunnelers.length < maxTunnelers;
        let willSpawn = canSpawn && PRNG.chance(this.rng, spawnChance);

        if (willSpawn) {
          let willMutate = PRNG.chance(this.rng, mutationChance);
          let pos = Point.clone(tunneler.pos);
          let dir = willMutate ? PRNG.element(this.rng, directions) : tunneler.dir;
          let spade = willMutate ? PRNG.element(this.rng, spades) : tunneler.spade;
          tunnelers.push({ pos, dir, spade });
        }

        if (PRNG.chance(this.rng, deathChance)) {
          tunnelers.splice(tunnelers.indexOf(tunneler), 1);
          continue;
        }

        for (let i = 0; i < 9; i++) {
          let _x = (i % 3 | 0);
          let _y = (i / 3 | 0);
          let bit = tunneler.spade & (1 << i);
          if (bit) dig(x + _x - 1, y + _y - 1);
        }

        let vec = directionToGridVector(tunneler.dir);
        let pos = Point.translated(tunneler.pos, vec);

        if (pos.x >= 0 && pos.y >= 0 && pos.x < this.width && pos.y < this.height) {
          tunneler.pos = pos;
        }

        if (PRNG.chance(this.rng, turnChance)) {
          tunneler.dir = PRNG.element(this.rng, directions);
        }

        if (PRNG.chance(this.rng, mutationChance)) {
          tunneler.spade = PRNG.element(this.rng, spades);
        }
      }
    }

    return this;
  }

  cellularAutomata({
    iterations = 10,
    neighbourhood = Point.mooreNeighbours,
    rules,
  }: {
    rules: CellularAutomataRules,
    iterations?: number;
    neighbourhood?: typeof Point.mooreNeighbours;
  }) {
    let nextMap = new Uint8Array(this.grid.length);
    let [born, survive] = rules;

    for (let i = 0; i < iterations; i++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          let tile = this.get(x, y);
          if (tile == null) continue;

          let neighbours = neighbourhood({ x, y });

          let score = neighbours.filter(n => {
            let neighbour = this.get(n.x, n.y);
            return neighbour === Marker.Wall;
          }).length;

          if (tile === Marker.Wall && !survive.includes(score)) {
            tile = Marker.Floor;
          } else if (tile === Marker.Floor && born.includes(score)) {
            tile = Marker.Wall;
          }

          nextMap[x + y * this.width] = tile;
        }
      }

      let temp = nextMap;
      nextMap = this.grid;
      this.grid = temp;
    }

    return this;
  }

  addPerimeterWall() {
    let y0 = 0;
    let y1 = this.height - 1;
    let x0 = 0;
    let x1 = this.width - 1;

    for (let x = 0; x < this.width; x++) {
      this.set(x, y0, Marker.Wall);
      this.set(x, y1, Marker.Wall);
    }

    for (let y = 0; y < this.height; y++) {
      this.set(x0, y, Marker.Wall);
      this.set(x1, y, Marker.Wall);
    }

    return this;
  }

  getAccessiblePoints(start: Point.Point): Point.Point[] {
    let visited = new Set<number>();
    let stack = [start];
    let area: Point.Point[] = [];

    while (stack.length) {
      let point = stack.pop()!;
      area.push(point);

      for (let neighbour of Point.vonNeumannNeighbours(point)) {
        if (
          neighbour.x < 0 ||
          neighbour.y < 0 ||
          neighbour.x >= this.width ||
          neighbour.y >= this.height
        ) continue;

        let id = neighbour.x + neighbour.y * this.width;
        if (visited.has(id)) continue;

        let marker = this.get(neighbour.x, neighbour.y);
        if (marker === Marker.Wall) continue;

        visited.add(id);
        stack.push(neighbour);
      }
    }

    return area;
  }

  build<T>(mapper: (marker: Marker) => T) {
    let markers = Array.from(this.grid);
    let markers2D = Array2D.fromArray(this.width, this.height, markers);
    return Array2D.map(markers2D, mapper);
  }
}

export const Spades = {
  OneByOne: 0b000_010_000,
  TwoByTwo: 0b110_110_000,
  ThreeByThree: 0b111_111_111,
  Star: 0b101_010_101,
  Cross: 0b010_111_010,
  Circle: 0b010_101_010,
};