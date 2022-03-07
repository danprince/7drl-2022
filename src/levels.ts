import { Game, Level, Player, Tile, TileType } from "./game";
import { assert } from "./helpers";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Abilities from "./abilities";
import * as Vestiges from "./vestiges";
import * as Statuses from "./statuses";
import * as Levels from "./levels";
import * as Handlers from "./handlers";
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
  return new Builder(21, 21)
    .caves(0.6, 10)
    .build(marker => {
      switch (marker) {
        case TileMarker.Wall:
          return Tiles.Wall;
        case TileMarker.Floor:
          if (RNG.chance(0.05)) {
            return Tiles.Bones;
          } else {
            return Tiles.Floor;
          }
      }
    });
}