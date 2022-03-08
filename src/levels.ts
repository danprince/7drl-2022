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

interface DiggerOptions {
  count: number;
  iterations: number;
  rotationChance: number;
  spades: number[];
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

  // TODO: Support different diggers using different kernels
  // TODO: Export some interesting kernel shapes
  // TODO: Symmetrical diggers
  diggers({
    count = 1,
    iterations = 10,
    spades = [0b000_010_000],
    turnChance = 0.1,
    turns = [Direction.rotateLeft45, Direction.rotateRight45],
    initialDirections = Direction.DIRECTIONS,
  }: {
    count?: number;
    iterations?: number;
    spades?: number[];
    turnChance?: number;
    turns?: ((dir: Direction.Direction) => Direction.Direction)[];
    initialDirections?: Direction.Direction[];
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

        if (nw) this.set(x - 1, y - 1, TileMarker.Floor);
        if (n)  this.set(x - 0, y - 1, TileMarker.Floor);
        if (ne) this.set(x + 1, y - 1, TileMarker.Floor);
        if (w)  this.set(x - 1, y - 0, TileMarker.Floor);
        if (c)  this.set(x - 0, y - 0, TileMarker.Floor);
        if (e)  this.set(x + 1, y - 0, TileMarker.Floor);
        if (sw) this.set(x - 1, y + 1, TileMarker.Floor);
        if (s)  this.set(x - 0, y + 1, TileMarker.Floor);
        if (se) this.set(x + 1, y + 1, TileMarker.Floor);

        let vec = directionToGridVector(digger.dir);
        Point.translate(digger.pos, vec);

        if (RNG.chance(turnChance)) {
          let turn = RNG.element(turns);
          digger.dir = turn(digger.dir);
          console.log(turn, digger.dir)
        }
      }
    }

    return this;
  }

  caves(iterations: number = 10) {
    let outOfBoundsMarker = TileMarker.Wall;
    // TODO: Extract CA logic
    for (let i = 0; i < iterations; i++) {
      let map: TileMarker[] = [];

      for (let { x, y } of this.cells()) {
        let tile = this.get(x, y);
        let neighbours = Point.mooreNeighbours({ x, y });

        let sameNeighbours = neighbours.filter(n => {
          let neighbour = this.get(n.x, n.y) ?? outOfBoundsMarker;
          return tile === neighbour;
        });

        let count = sameNeighbours.length;

        if (tile === TileMarker.Floor && count < 4) {
          map[x + y * this.width] = TileMarker.Wall;
        } else if (tile === TileMarker.Wall && count < 4) {
          map[x + y * this.width] = TileMarker.Floor;
        } else if (tile != null) {
          map[x + y * this.width] = tile;
        }
      }

      this.map = map;
    }

    return this;
  }

  noise(bias: number = 0.5) {
    for (let { x, y } of this.cells()) {
      if (PRNG.chance(this.rng, 1 - bias)) {
        this.map[x + y * this.width] = TileMarker.Wall;
      }
    }
  }

  randomCell() {
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
        console.log("door", x, y);
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
      count: 10,
      iterations: 10,
      spades: [0b010_111_010, 0b111_001_001],
      turnChance: 0.01,
      initialDirections: Direction.CARDINAL_DIRECTIONS,
      turns: [Direction.rotateLeft90],
    })
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