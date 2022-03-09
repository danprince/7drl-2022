import { Array2D, Point, RNG, PRNG, Direction } from "silmarils";
import { Entity, Level, LevelType, Substance, Tile, TileType } from "./game";
import { assert, directionToGridVector } from "./helpers";

// Quality tests to ensure that it's possible to get from the spawn
// to at least one exit.


// Next steps
// - Playtime event handlers
// - Prevent rooms from overlapping other rooms?
// - Each room has a cost and each level has a budget
//   - For example, centerpiece costs 100, no budget left
//   - Alternatively, smaller, less important room might cost 10
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

export interface RoomBuilderOptions {
  rotates: boolean;
  rarity: Rarity;
  cost: number;
  levelTypes: LevelType[];

  afterBuild(context: RoomBuilderContext): void;
}

export class RoomBuilder {
  cells: Array2D.Array2D<CellBuilder>;

  options: RoomBuilderOptions = {
    rotates: true,
    rarity: Rarity.Common,
    cost: 25,
    levelTypes: [],
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
  Exit,
}

export enum Symmetry {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
  Both = 3,
}

export class LevelBuilder {
  levelType: LevelType;
  rng: PRNG.RNG;
  map: TileMarker[] = [];
  width: number;
  height: number;

  static roomBuilders: Record<string, RoomBuilder> = {};

  static registerRoomBuilders(roomBuilders: Record<string, RoomBuilder>) {
    Object.assign(this.roomBuilders, roomBuilders);
  }

  static getRoomBuildersByType(levelType: LevelType) {
    return Object.values(this.roomBuilders).filter(builder => {
      return builder.options.levelTypes.includes(levelType);
    });
  }

  static build(levelType: LevelType, width = 21, height = 21) {
    let builder = new LevelBuilder(levelType, width, height);
    return levelType.build(builder);
  }

  constructor(levelType: LevelType, width: number, height: number) {
    this.levelType = levelType;
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

  swapOne(src: TileMarker, dst: TileMarker): LevelBuilder {
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

  build(
    mapper: (marker: TileMarker) => TileType
  ): Level {
    let level = new Level(this.levelType, this.width, this.height);

    for (let { x, y } of this.cells()) {
      let mark = this.get(x, y)!;
      let type = mapper(mark);
      let tile = new Tile(type);
      level.setTile(x, y, tile);
    }

    let budget = 100;
    let roomBuilders = LevelBuilder.getRoomBuildersByType(this.levelType);
    RNG.shuffle(roomBuilders);

    while (roomBuilders.length && budget > 0) {
      let roomBuilder = roomBuilders.pop()!;
      if (roomBuilder.options.cost > budget) continue;
      let built = roomBuilder.tryToBuild(level);
      if (built) budget -= roomBuilder.options.cost;
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
