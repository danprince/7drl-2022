import { Array2D, Point, RNG } from "silmarils";
import * as Entities from "./entities";
import * as Tiles from "./tiles";
import { Entity, Level, Substance, Tile, TileType } from "./game";
import { assert, getDirectionBetween } from "./helpers";
import { Chars } from "./chars";
import { Colors } from "./ui";

// Next steps
// - Playtime event handlers
// - Prevent rooms from overlapping other rooms?

export type TileConstraint = (tile: Tile) => boolean;

export type CreateTile =
  | TileType
  | (() => Tile);

export type CreateEntity =
  | (() => Entity);

export type CreateSubstance =
  | (() => Substance);

export interface CellBuilder {
  key?: string;
  tile?: CreateTile;
  spawn?: CreateEntity;
  constraint?: TileConstraint;
  substance?: CreateSubstance;
}

export class BuilderContext {
  entitiesByKey: Record<string, Entity[]> = {};
  tilesByKey: Record<string, Tile[]> = {};
  substancesByKey: Record<string, Substance[]> = {};

  addEntity(key: string, entity: Entity) {
    (this.entitiesByKey[key] = this.entitiesByKey[key] || []).push(entity);
  }

  addTile(key: string, tile: Tile) {
    (this.tilesByKey[key] = this.tilesByKey[key] || []).push(tile);
  }

  addSubstance(key: string, substance: Substance) {
    (this.substancesByKey[key] = this.substancesByKey[key] || []).push(substance);
  }

  findEntity<T extends Entity>(key: string): T {
    return this.entitiesByKey[key][0] as T;
  }

  findEntities(key: string) {
    return this.entitiesByKey[key];
  }

  findTiles(key: string) {
    return this.tilesByKey[key];
  }
}

export interface RoomBuilderOptions {
  rotates: boolean;
  // TODO: Rarity, size, area, etc

  afterBuild(context: BuilderContext): void;
}

export class RoomBuilder {
  cells: Array2D.Array2D<CellBuilder>;

  options: RoomBuilderOptions = {
    rotates: true,
    afterBuild: () => {},
  };

  constructor(
    template: string,
    legend: Record<string, Omit<CellBuilder, "key">>,
    options: Partial<RoomBuilderOptions> = {},
  ) {
    let map = Array2D.fromString(template);

    this.cells = Array2D.map(map, (char) => {
      return { key: char, ...legend[char] };
    });

    this.options = { ...this.options, ...options };
  }

  checkConstraints(level: Level, origin: Point.Point): boolean {
    // TODO: Silmarils needs an iterator for array 2d
    for (let x = 0; x < this.cells.width; x++) {
      for (let y = 0; y < this.cells.height; y++) {
        let cell = Array2D.get(this.cells, x, y)!;
        let tile = level.getTile(origin.x + x, origin.y + y);

        if (cell.constraint && tile && cell.constraint(tile) === false) {
          return false;
        }
      }
    }

    return true;
  }

  tryToBuild(level: Level) {
    const maxTries = 100;

    for (let tries = 0; tries < maxTries; tries++) {
      if (this.options.rotates) {
        if (RNG.chance(0.5)) {
          this.cells = Array2D.rotateLeft90(this.cells);
        }
      }

      let origin = Point.from(
        RNG.int(0, level.width - this.cells.width),
        RNG.int(0, level.height - this.cells.height)
      );

      if (this.checkConstraints(level, origin)) {
        this.build(level, origin);
        return true;
      }
    }

    return false;
  }

  build(level: Level, origin: Point.Point) {
    let context = new BuilderContext();

    for (let x = 0; x < this.cells.width; x++) {
      for (let y = 0; y < this.cells.height; y++) {
        let pos = Point.translated(origin, [x, y]);
        let cell = Array2D.get(this.cells, x, y)!;

        if (cell.tile) {
          let tile = this.buildTile(cell.tile);
          tile.pos = Point.clone(pos);
          level.setTile(pos.x, pos.y, tile);
          context.addTile(cell.key!, tile);
        }

        if (cell.substance) {
          let substance = cell.substance();
          let tile = level.getTile(pos.x, pos.y);
          assert(tile, "no tile for substance");
          tile.setSubstance(substance);
          context.addSubstance(cell.key!, substance);
        }

        if (cell.spawn) {
          let entity = cell.spawn();
          entity.pos = Point.clone(pos);
          level.addEntity(entity);
          context.addEntity(cell.key!, entity);
        }
      }
    }

    this.options.afterBuild(context);
  }

  buildTile(tiler: CreateTile) {
    if (tiler instanceof TileType) {
      return new Tile(tiler);
    } else {
      return tiler();
    }
  }

  buildEntity(spawner: CreateEntity) {
    return spawner();
  }
}

export let RollingBoulder = new RoomBuilder(`
.O.
.@.
.@.
.@.
.L.
`, {
  "O": {
    spawn: () => new Entities.Boulder,
    tile: Tiles.Floor,
  },
  "@": {
    tile: Tiles.Floor,
  },
  "L": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
    spawn: () => new Entities.Lever(),
  },
}, {
  rotates: true,
  afterBuild(ctx) {
    let lever = ctx.findEntity<Entities.Lever>("L");
    let boulder = ctx.findEntity<Entities.Boulder>("O");
    lever.triggers = () => {
      // Prevent triggering boulder twice
      lever.triggers = () => {};
      let dir = getDirectionBetween(boulder.pos, lever.pos);
      boulder.push(dir);
    };
  }
});

export let JailCell = new RoomBuilder(`
*%%%*
#...#
#...#
##=##
**-**
`, {
  "=": {
    tile: Tiles.IronBars,
    constraint: tile => tile.type.walkable,
  },
  "#": {
    tile: Tiles.Wall,
  },
  "%": {
    tile: Tiles.Wall,
    constraint: tile => tile.type === Tiles.Wall,
  },
  ".": {
    tile: Tiles.Floor,
  },
  "-": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
  },
});

export let MountedBallista = new RoomBuilder(`
...
.B.
...
`, {
  ".": {
    constraint: tile => tile.type.walkable,
  },
  "B": {
    spawn: () => new Entities.Ballista(),
  },
});

export let SealedTreasureVault = new RoomBuilder(`
.###.
##$##
.###.
`, {
  "#": {
    tile: Tiles.Wall,
  },
  "$": {
    tile: Tiles.Floor,
    spawn: () => new Entities.Chest(),
  },
});

export let GuardRoom = new RoomBuilder(`
#########
#....%..#
#.%.....#
+....%..+
#.%.....#
#%%....%#
####+####
`, {
  "#": {
    tile: Tiles.Wall,
  },
  ".": {
    tile: Tiles.Floor,
  },
  "%": {
    spawn: () => {
      let entity = new Entities.Chest();
      entity.glyph.char = RNG.element(Chars.WoodenStuff);
      entity.glyph.fg = RNG.element(Colors.Oranges);
      return entity;
    },
  },
  "+": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
  },
});
