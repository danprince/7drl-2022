import { Entity, Level, Tile, TileType } from "./game";
import { assert } from "./helpers";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import { Point, PRNG, RNG } from "silmarils";

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

  caves(openess: number = 0.55, iterations: number = 10) {
    let outOfBoundsMarker = TileMarker.Wall;

    for (let { x, y } of this.cells()) {
      if (PRNG.chance(this.rng, 1 - openess)) {
        this.map[x + y * this.width] = TileMarker.Wall;
      }
    }

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

  openess() {
    return (
      this.map.filter(marker => marker === TileMarker.Floor).length /
      this.map.length
    );
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

    for (let i = 0; i < 5; i++) {
      let entity = PRNG.weighted<Entity>(this.rng, [
        { weight: 1, value: new Entities.Mantleshell },
        { weight: 1, value: new Entities.Wizard },
        { weight: 1, value: new Entities.Thwomp },
        { weight: 1, value: new Entities.Boulder },
        { weight: 1, value: new Entities.Cultist },
        { weight: 1, value: new Entities.Boar },
        { weight: 1, value: new Entities.FossilKnight },
        { weight: 1, value: new Entities.Frog },
        { weight: 1, value: new Entities.Imp },
        { weight: 1, value: new Entities.Krokodil },
        { weight: 1, value: new Entities.Lizard },
        { weight: 1, value: new Entities.Maguana },
        { weight: 1, value: new Entities.Slimeshell },
        { weight: 1, value: new Entities.Stoneshell },
        { weight: 1, value: new Entities.Snake },
        { weight: 1, value: new Entities.Ant },
      ]);

      let x = PRNG.int(this.rng, 0, this.width);
      let y = PRNG.int(this.rng, 0, this.height);
      entity.pos = { x, y };
      level.addEntity(entity);
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
  return new Builder(21, 21)
    .caves(0.6, 10)
    .swapOne(TileMarker.Floor, TileMarker.Exit)
    .build(marker => {
      switch (marker) {
        case TileMarker.Wall:
          return Tiles.Wall;
        case TileMarker.Exit:
          return Tiles.Doorway;
        case TileMarker.Floor:
          if (RNG.chance(0.05)) {
            return Tiles.Bones;
          } else {
            return Tiles.Floor;
          }
      }
    });
}