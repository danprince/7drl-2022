import { Array2D, Point, RNG, PRNG, Direction } from "silmarils";
import { Entity, Level, LevelType, Substance, Tile, TileType } from "./game";
import { assert, directionToGridVector } from "./helpers";
import * as Tiles from "./tiles";

// Quality tests to ensure that it's possible to get from the spawn
// to at least one exit.

// TODO: Default legend for room builders?

// Next steps
// - Playtime event handlers
// - Prevent rooms from overlapping other rooms?
//
// Should builders be abstract?
// Probably want to say "reward" rather than chest and let some
// other stage of the engine figure out what to put there.
//
// What about rooms that are hardcoded though?

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

export class ConstraintError extends Error {}

export class RoomBuilderContext {
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

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
}

const CHANCE_UNCOMMON = 0.25;
const CHANCE_RARE = 0.05;

export interface RoomBuilderOptions {
  rotates: boolean;
  rarity: Rarity;
  cost: number;
  levelTypes: LevelType[];
  legend: Record<string, Omit<CellBuilder, "key">>;

  afterBuild(context: RoomBuilderContext): void;
}

export class RoomBuilder {
  id: string;
  cells: Array2D.Array2D<CellBuilder>;

  options: RoomBuilderOptions = {
    rotates: true,
    rarity: Rarity.Common,
    cost: 25,
    levelTypes: [],
    legend: {},
    afterBuild: () => {},
  };

  constructor(
    id: string,
    template: string,
    options: Partial<RoomBuilderOptions> = {},
  ) {
    this.id = id;
    this.options = { ...this.options, ...options };

    let map = Array2D.fromString(template);
    this.cells = Array2D.map(map, (char) => {
      let { legend } = this.options;
      return { key: char, ...legend[char] };
    });
  }

  checkConstraints(level: Level, origin: Point.Point): boolean {
    // TODO: Need some way for a tile constraint to require that it is accessible
    // from a certain point etc

    // TODO: Silmarils needs an iterator for array 2d
    for (let x = 0; x < this.cells.width; x++) {
      for (let y = 0; y < this.cells.height; y++) {
        let cell = Array2D.get(this.cells, x, y)!;
        let tile = level.getTile(origin.x + x, origin.y + y);
        if (tile == null) continue;
        let pass = cell.constraint ? cell.constraint(tile) : true;
        if (!pass) return false;
      }
    }

    return true;
  }

  tryToBuild(
    level: Level,
    isRestricted: (x: number, y: number) => boolean
  ) {
    const maxTries = 100;

    for (let tries = 0; tries < maxTries; tries++) {
      // Orientation doesn't matter for some room builders
      if (this.options.rotates) {
        if (RNG.chance(0.5)) {
          this.cells = Array2D.rotateLeft90(this.cells);
        }
      }

      // Pick a random point to be the top left of the template
      let origin = Point.from(
        RNG.int(0, level.width - this.cells.width),
        RNG.int(0, level.height - this.cells.height)
      );

      // Check whether we'd be building over any restricted cells (e.g. exit tiles)
      for (let x = origin.x; x < this.cells.width; x++) {
        for (let y = origin.y; y < this.cells.height; y++) {
          if (isRestricted(x, y)) {
            console.log("violated tile restrictions", this.id);
            continue;
          }
        }
      }

      // Check whether the template would violate any tile constraints
      if (this.checkConstraints(level, origin) === false) {
        console.log("constraints check failed", this.id);
        continue;
      }

      this.build(level, origin);
      return true;
    }

    return false;
  }

  build(level: Level, origin: Point.Point) {
    let context = new RoomBuilderContext();

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

export enum TileMarker {
  Floor,
  Wall,
}

export enum Symmetry {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
  Both = 3,
}

export const roomBuilderRegistry: Record<string, RoomBuilder> = {};

export function registerRoomBuilders(builders: Record<string, RoomBuilder>) {
  Object.assign(roomBuilderRegistry, builders);
}

export function getRoomBuildersByType(levelType: LevelType) {
  return Object.values(roomBuilderRegistry).filter(builder => {
    return (
      // Builders with no specific level type can go anywhere
      builder.options.levelTypes.length === 0 ||
      // Otherwise they need to match the current level
      builder.options.levelTypes.includes(levelType)
    );
  });
}

export class LevelBuilder {
  static build(levelType: LevelType, width = 21, height = 21): Level {
    for (let tries = 0; tries < 100; tries++) {
      console.groupCollapsed("Build", levelType.name);
      let builder = new LevelBuilder(levelType, width, height);

      try {
        return levelType.build(builder);
      } catch (err: any) {
        if (err instanceof ConstraintError) {
          console.error(err.message, builder);
          continue;
        } else {
          throw err;
        }
      } finally {
        console.groupEnd();
      }
    }

    throw new Error("Could not generate a level");
  }

  levelType: LevelType;
  rng: PRNG.RNG;
  map: TileMarker[] = [];
  width: number;
  height: number;
  entrance: Point.Point = { x: -1, y: - 1};
  exits: Point.Point[] = [];

  constructor(levelType: LevelType, width: number, height: number) {
    this.levelType = levelType;
    this.rng = PRNG.generator(Date.now());
    this.width = width;
    this.height = height;

    for (let { x, y } of this.cells()) {
      this.map[x + y * width] = TileMarker.Floor;
    }
  }

  private *cells() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        yield Point.from(x, y);
      }
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

  addPerimeterWall() {
    let y0 = 0;
    let y1 = this.height - 1;
    let x0 = 0;
    let x1 = this.width - 1;

    for (let x = 0; x < this.width; x++) {
      this.set(x, y0, TileMarker.Wall);
      this.set(x, y1, TileMarker.Wall);
    }

    for (let y = 0; y < this.height; y++) {
      this.set(x0, y, TileMarker.Wall);
      this.set(x1, y, TileMarker.Wall);
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

  private randomCell(): Point.Point {
    return {
      x: PRNG.int(this.rng, 0, this.width),
      y: PRNG.int(this.rng, 0, this.height),
    };
  }

  private randomCellByType(type: TileMarker) {
    for (let retry = 0; retry < 100; retry++) {
      let { x, y } = this.randomCell();
      let marker = this.get(x, y);
      if (marker === type) {
        return { x, y };
      }
    }

    throw new ConstraintError("Could not find marker. Ran out of tries");
  }

  createEntrance() {
    this.entrance = this.randomCellByType(TileMarker.Floor);
    console.log(this.entrance);
    return this;
  }

  createExit() {
    // TODO: Parameterise to put exits far away from entrances?
    let exit = this.randomCellByType(TileMarker.Floor);
    this.exits.push(exit);
    return this;
  }

  build(
    mapper: (marker: TileMarker) => TileType
  ): Level {
    let level = new Level(this.levelType, this.width, this.height);

    let restrictedCells = new Set<number>();

    const restrict = (x: number, y: number) =>
      restrictedCells.add(x + y * this.width);

    const isRestricted = (x: number, y: number) =>
      restrictedCells.has(x + y * this.width);

    level.entrance = this.entrance;
    level.exits = this.exits;

    // Prevent building over the entrances/exits
    restrict(level.entrance.x, level.entrance.y);
    level.exits.forEach(({ x, y }) => restrict(x, y));

    // TODO: Restrict all tiles on the shortest path from entrance to exit?

    // Convert the tile markers into actual tiles
    for (let { x, y } of this.cells()) {
      let mark = this.get(x, y)!;
      let type = mapper(mark);
      let tile = new Tile(type);
      level.setTile(x, y, tile);
    }

    // Create a queue of rooms that we can build in this level type
    let roomBuilderQueue = getRoomBuildersByType(this.levelType);

    // Prevent room selection bias
    RNG.shuffle(roomBuilderQueue);

    let budget = RNG.int(50, 150);

    while (roomBuilderQueue.length) {
      let roomBuilder = roomBuilderQueue.shift()!;
      let { rarity } = roomBuilder.options;

      if (rarity === Rarity.Uncommon && !RNG.chance(CHANCE_UNCOMMON)) {
        continue;
      }

      if (rarity === Rarity.Rare && !RNG.chance(CHANCE_RARE)) {
        continue;
      }

      if (roomBuilder.options.cost > budget) {
        continue;
      }

      let built = roomBuilder.tryToBuild(level, isRestricted);

      if (built) {
        budget -= roomBuilder.options.cost;
        console.log("placed", roomBuilder.id);
      } else {
        console.log("failed to place", roomBuilder.id);
      }

      if (budget < 10) {
        console.log("no more budget");
        break;
      }

      if (roomBuilderQueue.length === 0) {
        console.log("out of rooms");
        break;
      }
    }

    let map = level.getDijkstraMap(level.entrance);

    let accessibleExits = level.exits.filter(exit => {
      let path = map.pathTo(exit);
      return path.length > 0;
    });

    if (accessibleExits.length === 0) {
      throw new ConstraintError("No accessible exits");
    }

    for (let exit of accessibleExits) {
      let door = new Tile(Tiles.Doorway);

      door.onEnter = entity => {
        if (entity === game.player) {
          let level = LevelBuilder.build(this.levelType);
          game.setLevel(level);
        }
      };

      level.setTile(exit.x, exit.y, door);
    }

    return level;
  }
}
