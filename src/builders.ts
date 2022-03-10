import { Array2D, Point, Direction, PRNG, RNG } from "silmarils";
import { Entity, Level, LevelType, Substance, Tile, TileType } from "./game";
import { assert, directionToGridVector, maxBy, minBy, PointSet } from "./helpers";
import * as Legend from "./legend";
import * as Tiles from "./tiles";

export const CHANCE_UNCOMMON = 0.25;
export const CHANCE_RARE = 0.05;
const LEVEL_BUILDER_RETRIES = 100;
const ROOM_BUILDER_RETRIES = 100;

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
}

let debug = console.debug;

export interface LevelConstraints {
  minAccessibleTilesPercent: number;
  maxAccessibleTilesPercent: number;
  minCriticalPathLength: number;
  maxCriticalPathLength: number;
}

const defaultLevelConstraints: LevelConstraints = {
  minAccessibleTilesPercent: 0.3,
  maxAccessibleTilesPercent: 1,
  minCriticalPathLength: 10,
  maxCriticalPathLength: Infinity,
};

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

export interface RoomBuilderOptions {
  rotates: boolean;
  rarity: Rarity;
  cost: number;
  levelTypes: LevelType[];
  legend: Legend.Legend;

  afterBuild(context: RoomBuilderContext): void;
}

export type RoomVariantBuilder = Array2D.Array2D<Legend.CellBuilder>;

export class RoomBuilder {
  id: string;
  variants: RoomVariantBuilder[] = [];

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
    templates: string[],
    options: Partial<RoomBuilderOptions> = {},
  ) {
    this.id = id;
    this.options = { ...this.options, ...options };

    this.variants = templates.map(template => {
      let map = Array2D.fromString(template);

      return Array2D.map(map, key => {
        let entry = (
          this.options.legend[key] ||
          Legend.defaultLegend[key]
        );

        return { key, ...entry };
      });
    });
  }

  checkRules(
    level: Level,
    origin: Point.Point,
    finalised: PointSet,
    variant: RoomVariantBuilder,
  ): boolean {
    for (let x = 0; x < variant.width; x++) {
      for (let y = 0; y < variant.height; y++) {
        let pos = Point.translated(origin, [x, y]);
        let cell = Array2D.get(variant, x, y);

        // Check whether the cell will actually build anything here
        let willBuild = cell && (cell.spawn || cell.substance || cell.tile);

        // Don't build over finalised tiles (e.g. rooms, entrances/exits)
        if (willBuild && finalised.has(pos)) {
          return false;
        }

        let tile = level.getTile(pos.x, pos.y);
        if (tile == null) continue;

        if (!cell?.rule?.(tile, level)) {
          return false;
        }
      }
    }

    return true;
  }

  tryToBuild(
    level: Level,
    finalised: PointSet,
    rng: PRNG.RNG,
  ) {
    for (let tries = 0; tries < ROOM_BUILDER_RETRIES; tries++) {
      let variant = PRNG.element(rng, this.variants);

      // Orientation doesn't matter for some room builders
      if (this.options.rotates) {
        let rotations = PRNG.int(rng, 0, 3);
        for (let i = 0; i < rotations; i++) {
          variant = Array2D.rotateLeft90(variant);
        }
      }

      // Pick a random point to be the top left of the template, ensuring
      // that it is inside the bounds of the level.
      let origin = Point.from(
        PRNG.int(rng, 0, level.width - variant.width),
        PRNG.int(rng, 0, level.height - variant.height)
      );

      // Check whether the template would violate any tile constraints
      if (this.checkRules(level, origin, finalised, variant) === false) {
        debug("constraints check failed", this.id);
        continue;
      }

      this.build(level, origin, finalised, variant);
      return true;
    }

    return false;
  }

  build(
    level: Level,
    origin: Point.Point,
    finalised: PointSet,
    variant: RoomVariantBuilder
  ) {
    let context = new RoomBuilderContext();

    for (let x = 0; x < variant.width; x++) {
      for (let y = 0; y < variant.height; y++) {
        let pos = Point.translated(origin, [x, y]);
        let cell = Array2D.get(variant, x, y)!;

        if (cell.tile || cell.substance || cell.spawn) {
          finalised.add(pos);
        }

        if (cell.tile) {
          let tile = cell.tile instanceof TileType
            ? new Tile(cell.tile)
            : new Tile(cell.tile(level));
          level.setTile(pos.x, pos.y, tile);
          context.addTile(cell.key!, tile);
        }

        if (cell.substance) {
          let substance = cell.substance(level);
          let tile = level.getTile(pos.x, pos.y);
          assert(tile, "no tile for substance");
          tile.setSubstance(substance);
          context.addSubstance(cell.key!, substance);
        }

        if (cell.spawn) {
          let entity = cell.spawn(level);
          entity.pos = Point.clone(pos);
          level.addEntity(entity);
          context.addEntity(cell.key!, entity);
        }
      }
    }

    this.options.afterBuild(context);
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
  private static rng = PRNG.generator(0);

  static setSeed(seed: number) {
    this.rng = PRNG.generator(seed);
  }

  static build(levelType: LevelType, width = 21, height = 21): Level {
    console.time("builder");

    for (let tries = 0; tries < LEVEL_BUILDER_RETRIES; tries++) {
      // Important that we use a separately seeded generator for the
      // level builder, because we want the levels to be the same every
      // time, regardless of other actions on the main RNG.
      let seed = PRNG.int(this.rng);
      let builder = new LevelBuilder(levelType, width, height, seed);

      try {
        let level = levelType.build(builder);
        console.timeEnd("builder");
        return level;
      } catch (err: any) {
        if (err instanceof ConstraintError) {
          debug(`Failed to build: "${levelType.name}"`, err.message, builder);
          continue;
        } else {
          throw err;
        }
      }
    }

    throw new Error("Could not generate a level");
  }

  levelType: LevelType;
  map: Uint8Array;
  width: number;
  height: number;
  rng: PRNG.RNG;

  constructor(levelType: LevelType, width: number, height: number, seed: number) {
    this.levelType = levelType;
    this.width = width;
    this.height = height;
    this.map = new Uint8Array(width * height);
    this.rng = PRNG.generator(seed);
    this.map.fill(TileMarker.Floor);
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
      let x = PRNG.int(this.rng, 0, this.width);
      let y = PRNG.int(this.rng, 0, this.height);
      let pos = Point.from(x, y);
      let dir = PRNG.element(this.rng, initialDirections);
      let spade = PRNG.element(this.rng, spades);
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

        if (PRNG.chance(this.rng, turnChance)) {
          let turn = PRNG.element(this.rng, turns);
          digger.dir = turn(digger.dir);
        }

        if (PRNG.chance(this.rng, mutationChance)) {
          digger.spade = PRNG.element(this.rng, spades);
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
    let nextMap = new Uint8Array(this.map.length);

    for (let i = 0; i < iterations; i++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
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

          nextMap[x + y * this.width] = tile;
        }
      }

      let temp = nextMap;
      nextMap = this.map;
      this.map = temp;
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
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.map[x + y * this.width] = PRNG.chance(this.rng, bias)
          ? TileMarker.Wall
          : TileMarker.Floor;
      }
    }

    return this;
  }

  private randomCell(): Point.Point {
    return {
      x: PRNG.int(this.rng, 0, this.width),
      y: PRNG.int(this.rng, 0, this.height),
    };
  }

  build(constraints: Partial<LevelConstraints>): Level {
    let level = new Level(this.levelType, this.width, this.height);

    // Convert the tile markers into actual tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let mark = this.get(x, y)!;
        let type = mark === TileMarker.Wall
          ? level.type.characteristics.defaultWallTile
          : level.type.characteristics.defaultFloorTile;
        let tile = new Tile(type);
        level.setTile(x, y, tile);
      }
    }

    let decorator = new LevelDecorator(level, constraints, this.rng);
    return decorator.finalise();
  }
}

export class LevelDecorator {
  level: Level;
  rng: PRNG.RNG;
  finalised = new PointSet();
  constraints: LevelConstraints;

  constructor(level: Level, constraints: Partial<LevelConstraints>, rng: PRNG.RNG) {
    this.level = level;
    this.rng = rng;
    this.constraints = { ...defaultLevelConstraints, ...constraints };
  }

  private randomCell(): Point.Point {
    return {
      x: PRNG.int(this.rng, 0, this.level.width),
      y: PRNG.int(this.rng, 0, this.level.height),
    };
  }

  private findOpenCenter(): Point.Point {
    let points = this.level.points();

    return minBy(points, ({ x, y }) => {
      let tile = this.level.getTile(x, y);
      if (tile == null || !tile.type.walkable) return Infinity;
      let cx = Math.ceil(x - this.level.width / 2);
      let cy = Math.ceil(y - this.level.height / 2);
      return Math.abs(cx) + Math.abs(cy);
    });
  }

  addEntranceAndExit() {
    let center = this.findOpenCenter();
    let centerMap = this.level.getDijkstraMap(center);
    let points = Array.from(this.level.points());
    let entrance = maxBy(points, pos => centerMap.finiteDistanceTo(pos));
    let entranceMap = this.level.getDijkstraMap(entrance);
    let exit = maxBy(points, pos => entranceMap.finiteDistanceTo(pos));

    this.level.entrance = entrance;
    this.level.exit = exit;

    // Prevent building over the entrances/exits
    this.finalised.add(this.level.entrance);
    this.finalised.add(this.level.exit);

    // Insert the door tiles
    let door = new Tile(Tiles.Doorway);

    door.onEnter = entity => {
      if (entity === game.player) {
        let level = LevelBuilder.build(this.level.type);
        game.setLevel(level);
      }
    };

    this.level.setTile(exit.x, exit.y, door);
  }

  roll(rarity: Rarity) {
    switch (rarity) {
      case Rarity.Uncommon:
        return PRNG.chance(this.rng, CHANCE_UNCOMMON);
      case Rarity.Rare:
        return PRNG.chance(this.rng, CHANCE_RARE);
      default:
        return true;
    }
  }

  addRooms() {
    // Create a queue of rooms that we can build in this level type
    let roomBuilderQueue = getRoomBuildersByType(this.level.type);

    // Prevent room selection bias
    PRNG.shuffle(this.rng, roomBuilderQueue);

    let budget = PRNG.int(this.rng, 50, 150);

    while (roomBuilderQueue.length) {
      let roomBuilder = roomBuilderQueue.shift()!;

      if (!this.roll(roomBuilder.options.rarity)) {
        continue;
      }

      if (roomBuilder.options.cost > budget) {
        continue;
      }

      let built = roomBuilder.tryToBuild(this.level, this.finalised, this.rng);

      if (built) {
        budget -= roomBuilder.options.cost;
      }

      if (RNG.chance(0.5)) {
        debug("Chance to rebuild");
        roomBuilderQueue.push(roomBuilder);
      }

      if (budget <= 10) {
        debug("Used up the budget!");
        break;
      }

      if (roomBuilderQueue.length === 0) {
        debug("Ran out of rooms");
        break;
      }
    }
  }

  addEntities() {
    // Generate a random number of entities in the level
    let spawnCount = PRNG.int(this.rng, 0, 4);
    let spawned: Entity[] = [];
    let tries = 0;

    while (spawned.length < spawnCount) {
      // Bail out if we're struggling
      if (tries++ > 10) break;

      let pos = this.randomCell();

      // Don't spawn entities into features that have been finalised
      if (this.finalised.has(pos)) continue;

      let tile = this.level.getTile(pos.x, pos.y);
      if (tile == null || !tile.type.walkable) continue;
      let entities = this.level.getEntitiesAt(pos.x, pos.y);
      if (entities.length > 0) continue;

      let uncommon = PRNG.chance(this.rng, CHANCE_UNCOMMON);
      let rare = PRNG.chance(this.rng, CHANCE_RARE);
      let types = this.level.type.characteristics.commonEntityTypes;

      if (rare) {
        types = this.level.type.characteristics.rareEntityTypes;
      } else if (uncommon) {
        types = this.level.type.characteristics.uncommonEntityTypes;
      }

      let entityType = PRNG.element(this.rng, types);
      let entity = new entityType();
      entity.pos = Point.clone(pos);
      this.level.addEntity(entity);
      spawned.push(entity);
    }
  }

  checkConstraints() {
    let { constraints } = this;

    let map = this.level.getDijkstraMap(this.level.entrance);
    let criticalPathLength = map.distanceTo(this.level.exit);

    if (criticalPathLength === Infinity) {
      throw new ConstraintError("Exit is not accessible");
    }

    let accessibleTilesCount = map.costSoFar.data.filter(isFinite).length;
    let accessibleTilePercent = accessibleTilesCount / (this.level.width * this.level.height);

    if (accessibleTilePercent < constraints.minAccessibleTilesPercent) {
      throw new ConstraintError("Not enough accessible tiles");
    } else if (accessibleTilePercent > constraints.maxAccessibleTilesPercent) {
      throw new ConstraintError("Too many accessible tiles");
    }

    if (criticalPathLength < constraints.minCriticalPathLength) {
      throw new ConstraintError("Critical path is too short");
    } else if (criticalPathLength > constraints.maxCriticalPathLength) {
      throw new ConstraintError("Critical path is too long");
    }
  }

  addFissures() {

  }

  finalise() {
    // TODO: Restrict all tiles on the critical path from entrance to exit?
    this.addEntranceAndExit();
    this.addRooms();
    this.addEntities();
    this.addFissures();
    this.checkConstraints();
    return this.level;
  }
}
