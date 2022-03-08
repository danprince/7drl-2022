import { Level, Tile, TileType } from "./game";
import { assert, directionToGridVector } from "./helpers";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Rooms from "./rooms";
import { Direction, Point, PRNG, RNG } from "silmarils";

interface Key {
  [ch: string]: {
    tile: TileType;
    tag?: string;
  }
}

enum TileMarker {
  Floor,
  Wall,
  Exit,
}

enum Symmetry {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
  Both = 3,
}

class Builder {
  rng: PRNG.RNG;
  map: TileMarker[] = [];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.rng = PRNG.generator(Date.now());
    this.width = width;
    this.height = height;

    for (let { x, y } of this.cells()) {
      this.map[x + y * width] = TileMarker.Floor;
    }
  }

  get(x: number, y: number): TileMarker | undefined {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      return this.map[x + y * this.width];
    } else {
      return;
    }
  }

  set(x: number, y: number, marker: TileMarker) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      return this.map[x + y * this.width] = marker;
    } else {
      return;
    }
  }

  fill(marker: TileMarker) {
    this.map.fill(marker);
    return this;
  }

  maze() {
    this.fill(TileMarker.Wall);
    let start = this.randomCell()
    let stack = [start];
    let seen = new Set<string>();

    const countAdjacentWalls = (p: Point.Point): number => {
      return Point
        .mooreNeighbours(p)
        .filter(pos => this.get(pos.x, pos.y) === TileMarker.Wall)
        .length;
    }

    while (stack.length) {
      let pos = stack.pop()!;
      let score = countAdjacentWalls(pos);
      if (score < 5) continue;

      this.set(pos.x, pos.y, TileMarker.Floor);

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

  diggers({
    count = 1,
    iterations = 10,
    spades = [0b000_010_000],
    turnChance = 0.1,
    mutationChance = 0,
    turns = [Direction.rotateLeft45, Direction.rotateRight45],
    initialDirections = Direction.DIRECTIONS,
    symmetry = Symmetry.None,
  }: {
    count?: number;
    iterations?: number;
    spades?: number[];
    turnChance?: number;
    mutationChance?: number;
    turns?: ((dir: Direction.Direction) => Direction.Direction)[];
    initialDirections?: Direction.Direction[];
    symmetry?: Symmetry;
  }) {
    interface Digger {
      dir: Direction.Direction,
      pos: Point.Point,
      spade: number,
    }

    let diggers: Digger[] = [];

    for (let i = 0; i < count; i++) {
      let x = RNG.int(0, this.width);
      let y = RNG.int(0, this.height);
      let pos = Point.from(x, y);
      let dir = RNG.element(initialDirections);
      let spade = RNG.element(spades);
      diggers.push({ dir, pos, spade });
    }

    const dig = (x: number, y: number) => {
      let tile = TileMarker.Floor;
      this.set(x, y, tile);
      if (symmetry & Symmetry.Vertical) this.set(this.width - 1 - x, y, tile);
      if (symmetry & Symmetry.Horizontal) this.set(x, this.height - 1 - y, tile);
      if (symmetry === Symmetry.Both) this.set(this.width - 1 - x, this.height - 1 - y, tile);
    }

    for (let i = 0; i < iterations; i++) {
      for (let digger of diggers) {
        let { x, y } = digger.pos;

        let nw = digger.spade & 0b100_000_000;
        let n  = digger.spade & 0b010_000_000;
        let ne = digger.spade & 0b001_000_000;
        let w  = digger.spade & 0b000_100_000;
        let c  = digger.spade & 0b000_010_000;
        let e  = digger.spade & 0b000_001_000;
        let sw = digger.spade & 0b000_000_100;
        let s  = digger.spade & 0b000_000_010;
        let se = digger.spade & 0b000_000_001;

        if (nw) dig(x - 1, y - 1);
        if (n)  dig(x - 0, y - 1);
        if (ne) dig(x + 1, y - 1);
        if (w)  dig(x - 1, y - 0);
        if (c)  dig(x - 0, y - 0);
        if (e)  dig(x + 1, y - 0);
        if (sw) dig(x - 1, y + 1);
        if (s)  dig(x - 0, y + 1);
        if (se) dig(x + 1, y + 1);

        let vec = directionToGridVector(digger.dir);
        Point.translate(digger.pos, vec);

        if (RNG.chance(turnChance)) {
          let turn = RNG.element(turns);
          digger.dir = turn(digger.dir);
        }

        if (RNG.chance(mutationChance)) {
          digger.spade = RNG.element(spades);
        }
      }
    }

    return this;
  }

  // TODO: Use Array2D
  // TODO: Extract CA logic
  cellularAutomata({
    iterations = 10,
    rules,
    outOfBoundsMarker = TileMarker.Wall,
  }: {
    rules: [birth: number[], survival: number[]];
    iterations?: number;
    outOfBoundsMarker?: TileMarker
  }) {
    for (let i = 0; i < iterations; i++) {
      let map: TileMarker[] = [];

      for (let { x, y } of this.cells()) {
        let tile = this.get(x, y);
        if (tile == null) continue;

        let neighbours = Point.mooreNeighbours({ x, y });

        let score = neighbours.filter(n => {
          let neighbour = this.get(n.x, n.y) ?? outOfBoundsMarker;
          return neighbour === TileMarker.Wall;
        }).length;

        let [birth, survival] = rules;

        if (tile === TileMarker.Wall && !survival.includes(score)) {
          tile = TileMarker.Floor;
        } else if (tile === TileMarker.Floor && birth.includes(score)) {
          tile = TileMarker.Wall;
        }

        map[x + y * this.width] = tile;
      }

      this.map = map;
    }

    return this;
  }

  noise(bias: number = 0.5) {
    for (let { x, y } of this.cells()) {
      this.map[x + y * this.width] = PRNG.chance(this.rng, bias)
        ? TileMarker.Wall
        : TileMarker.Floor;
    }

    return this;
  }

  randomCell(): Point.Point {
    return {
      x: PRNG.int(this.rng, 0, this.width),
      y: PRNG.int(this.rng, 0, this.height),
    };
  }

  swapOne(src: TileMarker, dst: TileMarker): Builder {
    for (let retry = 0; retry < 100; retry++) {
      let { x, y } = this.randomCell();
      let marker = this.get(x, y);

      if (marker === src) {
        this.set(x, y, dst);
        return this;
      }
    }

    throw new Error("Could not swap. Ran out of tries");
  }

  build(mapper: (marker: TileMarker) => TileType): Level {
    let level = new Level(this.width, this.height);

    for (let { x, y } of this.cells()) {
      let mark = this.get(x, y)!;
      let type = mapper(mark);
      let tile = new Tile(type);
      level.setTile(x, y, tile);
    }
    return level;
  }

  private *cells() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        yield Point.from(x, y);
      }
    }
  }
}

function levelFromSketch(sketch: string, key: Key): Level {
  let str = sketch.trim();
  let lines = str.split("\n");
  let height = lines.length;
  let width = lines[0].length;
  let level = new Level(width, height);

  for (let y = 0; y < height; y++) {
    let line = lines[y];

    assert(line.length === width, "uneven map");

    for (let x = 0; x < width; x++) {
      let char = line[x];
      let entry = key[char];
      assert(entry, `no key entry for "${char}"`);
      let tile = new Tile(entry.tile);
      level.setTile(x, y, tile);
    }
  }

  return level;
}

export function createTutorialLevel(): Level {
  return levelFromSketch(`
####################
#..................#
#..................#
#..................#
#######............#
##...##............#
###.###............#
###..##............#
#######........F...#
#.....#............#
#..................#
#..................#
#..................#
#..................#
#..................#
#..................#
#..................#
#..................#
#..................#
####################
  `, {
    ".": {
      tile: Tiles.Floor,
    },
    "#": {
      tile: Tiles.Wall,
    },
    "F": {
      tile: Tiles.Fissure,
      tag: "spawn",
    },
    "S": {
      tile: Tiles.Floor,
      tag: "spawn",
    },
  });
}

export function createLevel(): Level {
  let builder = new Builder(21, 21)
    .fill(TileMarker.Wall)
    .diggers({
      count: 5,
      iterations: 10,
      spades: [0b000010000, 0b010010010],
      symmetry: Symmetry.Vertical,
      turnChance: 0.01,
      turns: [Direction.rotateLeft90]
    })
    //.cellularAutomata({
    //  iterations: 10,
    //  rules: [[], [4, 5, 6, 7, 8]],
    //})
    .swapOne(TileMarker.Floor, TileMarker.Exit)

  let level = builder.build(marker => {
    switch (marker) {
      case TileMarker.Wall:
        return Tiles.Wall;
      case TileMarker.Exit:
        return Tiles.Doorway;
      case TileMarker.Floor:
        return Tiles.Floor;
    }
  });

  //Rooms.GuardRoom.tryToBuild(level);

  // TODO: Area specific decorations and ambient spawns

  return level;
}