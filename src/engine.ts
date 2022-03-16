import { Direction, Line, Point, Raster, Rectangle, RNG, Vector } from "silmarils";
import { Glyph, Chars } from "./common";
import { DealDamageEvent, DeathEvent, DespawnEvent, EnterLevelEvent, EventHandler, ExitLevelEvent, GainCurrencyEvent, GameEvent, InteractEvent, KillEvent, MoveEvent, PushEvent, SpawnEvent, StatusAddedEvent, StatusRemovedEvent, TakeDamageEvent, TileBumpEvent, TileEnterEvent, TileExitEvent, TryMoveEvent, VestigeAddedEvent } from "./events";
import { clamp, Constructor, DijkstraMap, directionToGridVector, OneOrMore } from "./helpers";
import { Terminal } from "./terminal";
import { Colors } from "./common";
import { Digger } from "./digger";

const ENERGY_REQUIRED_PER_TURN = 12;

export type GameMessageComponent = string | number | Glyph | Entity | DamageType | Status | Tile;
export type GameMessage = GameMessageComponent[];

export enum Rarity {
  Common,
  Uncommon,
  Rare,
}

interface MovementOptions {
  forced: boolean;
}

const defaultMovementOptions: MovementOptions = {
  forced: false
};

export type Effect = Generator<number, void>;

export type FX = (terminal: Terminal) => void;

export type Decoration = (characteristics: LevelCharacteristics) => [
  src: Array<TileType | undefined>,
  dst: Array<TileType | undefined>
];

export interface LevelCharacteristics {
  defaultFloorTile: TileType;
  defaultWallTile: TileType;
  defaultLiquidTile: TileType;
  defaultDoorTile: TileType;
  commonMonsterTypes: OneOrMore<Constructor<Entity>>;
  uncommonMonsterTypes: OneOrMore<Constructor<Entity>>;
  rareMonsterTypes: OneOrMore<Constructor<Entity>>;
  decorations: Decoration[];
  baseMonsterSpawnChance: number;
  maxRewards: number;
}

export class LevelType extends EventHandler {
  name: string;
  characteristics: LevelCharacteristics;
  dig: (digger: Digger, entrance: Point.Point) => void;

  constructor({
    name,
    characteristics,
    dig,
    ...events
  }: Partial<EventHandler> & {
    name: string;
    characteristics: LevelCharacteristics,
    dig: LevelType["dig"],
  }) {
    super();
    Object.assign(this, events);
    this.name = name;
    this.characteristics = characteristics;
    this.dig = dig;
  }
}

export class Level extends EventHandler {
  type: LevelType;
  width: number;
  height: number;
  entities: Entity[] = [];
  tiles: (Tile | undefined)[] = [];
  fx: FX[] = [];
  effects: Effect[] = [];
  entrancePoint: Point.Point = { x: -1, y: -1 };
  exitPoint: Point.Point = { x: -1, y: -1 };

  constructor(type: LevelType, width: number, height: number) {
    super();
    this.type = type;
    this.width = width;
    this.height = height;
  }

  enter() {
    new EnterLevelEvent(this).dispatch();
  }

  exit() {
    new ExitLevelEvent(this).dispatch();
  }

  onEvent(event: GameEvent): void {
    event.sendTo(this.type);
  }

  addFX(fx: FX) {
    this.fx.push(fx);
    return () => this.removeFX(fx);
  }

  removeFX(fx: FX) {
    this.fx.splice(this.fx.indexOf(fx), 1);
  }

  addEffect(effect: Effect) {
    this.effects.push(effect);
  }

  setTile(x: number, y: number, tile: Tile | undefined) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.tiles[x + y * this.width] = tile;

      if (tile) {
        tile.level = this;
        tile.pos = { x, y};
      }
    }
  }

  getTile(x: number, y: number): Tile | undefined {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      return this.tiles[x + y * this.width];
    } else {
      return;
    }
  }

  addEntity(entity: Entity) {
    if (entity instanceof Player) {
      this.entities.unshift(entity);
    } else {
      this.entities.push(entity);
    }

    entity.level = this;
    new SpawnEvent(entity).dispatch();
  }

  removeEntity(entity: Entity) {
    this.entities.splice(this.entities.indexOf(entity), 1);
  }

  getEntitiesAt(x: number, y: number) {
    return this.entities.filter(entity => {
      return entity.pos.x === x && entity.pos.y === y;
    });
  }

  getEntitiesAtPoint(point: Point.Point) {
    return this.getEntitiesAt(point.x, point.y);
  }

  getEntitiesInRect(rect: Rectangle.Rectangle): Entity[] {
    return this.entities.filter(entity => {
      return Rectangle.contains(rect, entity.pos);
    });
  }

  isInBounds(x: number, y: number) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height
    );
  }

  isOpen(x: number, y: number) {
    let tile = this.getTile(x, y);
    if (tile == null) return false;
    if (!tile.type.walkable) return false;
    let entities = this.getEntitiesAt(x, y);
    return entities.length === 0;
  }

  autotile(x0 = 0, y0 = 0, x1 = this.width - 1, y1 = this.height - 1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let tile = this.getTile(x, y);
        if (tile == null) continue;
        if (tile.type.autotiling == null) continue;

        let a = this.getTile(x - 1, y);
        let b = this.getTile(x, y - 1);
        let c = this.getTile(x + 1, y);
        let d = this.getTile(x, y + 1);
        let offset = 0;

        if (tile.type.autotiling.length == 2) {
          offset = d && d.type.autotiling === tile.type.autotiling ? 0 : 1;
        }

        if (tile.type.autotiling.length === 16) {
          offset =
            (a && a.type.autotiling === tile.type.autotiling ? 1 : 0) |
            (b && b.type.autotiling === tile.type.autotiling ? 2 : 0) |
            (c && c.type.autotiling === tile.type.autotiling ? 4 : 0) |
            (d && d.type.autotiling === tile.type.autotiling ? 8 : 0);
        }

        tile.glyph.char = tile.type.autotiling[offset];
      }
    }
  }

  getDijkstraMap(start: Point.Point) {
    return new DijkstraMap(
      this.width,
      this.height,
      start,
      (_, pos) => {
        let tile = this.getTile(pos.x, pos.y);
        if (tile == null) return Infinity;
        return tile.type.getMovementCost();
      }
    );
  }

  findShortestPath(start: Point.Point, end: Point.Point) {
    return this.getDijkstraMap(start).shortestPath(end);
  }

  points(): Point.Point[] {
    let points: Point.Point[] = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        points.push({ x, y });
      }
    }
    return points;
  }

  // TODO: This doesn't belong in the engine.
  hasKilledAllMonsters() {
    return this.entities.every(entity => {
      return (
        entity === game.player ||
        entity.dead
      );
    })
  }
}

interface VariantGlyph {
  char: string[];
  fg: number[];
  bg?: number[];
}

function isVariantGlyph(glyph: Glyph | VariantGlyph): glyph is VariantGlyph {
  return Array.isArray(glyph.fg);
}

interface TileTypeProps extends Partial<EventHandler> {
  walkable?: TileType["walkable"];
  glyph: TileType["glyph"];
  autotiling?: TileType["autotiling"];
  diggable?: TileType["diggable"];
  destructible?: TileType["destructible"];
  flyable?: TileType["flyable"];
  liquid?: TileType["liquid"];
  flammable?: TileType["flammable"];
  onCreate?: TileType["onCreate"]
  onUpdate?: TileType["onUpdate"]
}

export class TileType extends EventHandler {
  glyph: Glyph | VariantGlyph;
  autotiling?: string[];
  walkable: boolean;
  flyable: boolean;
  diggable: boolean;
  destructible: boolean;
  flammable: boolean;
  liquid: boolean;

  constructor({
    glyph,
    autotiling,
    walkable,
    flyable,
    diggable,
    flammable,
    destructible,
    liquid,
    ...events
  }: TileTypeProps) {
    super();
    Object.assign(this, events);
    this.glyph = glyph;
    this.autotiling = autotiling;
    this.walkable = walkable || false;
    this.flyable = flyable || false;
    this.diggable = diggable || false;
    this.flammable = flammable || false;
    this.destructible = destructible || false;
    this.liquid = liquid || false;
  }

  protected onCreate(tile: Tile) {}
  protected onUpdate(tile: Tile) {}

  create(tile: Tile) {
    this.onCreate(tile);
  }

  update(tile: Tile) {
    this.onUpdate(tile);
  }

  assignGlyph() {
    if (isVariantGlyph(this.glyph)) {
      return {
        char: RNG.element(this.glyph.char),
        fg: RNG.element(this.glyph.fg),
        bg: this.glyph.bg ? RNG.element(this.glyph.bg) : undefined,
      };
    } else {
      return { ...this.glyph };
    }
  }

  getMovementCost(): number {
    if (this.walkable) return 1;
    return Infinity;
  }

  getTraversalCost(): number {
    if (this.walkable) return 1;
    if (this.destructible) return 10;
    if (this.diggable) return 20;
    if (this.flammable) return 20;
    return Infinity;
  }
}

export class Tile extends EventHandler {
  level: Level = null!;
  pos: Point.Point = { x: 0, y: 0};
  type: TileType;
  glyph: Glyph;
  substance: Substance | undefined;

  constructor(type: TileType) {
    super();
    this.type = type;
    this.glyph = type.assignGlyph();
    this.type.create(this);
  }

  neighbours(): Tile[] {
    return Point
      .mooreNeighbours(this.pos)
      .map(xy => game.level.getTile(xy.x, xy.y))
      .filter(tile => tile != null) as Tile[];
  }

  enter(entity: Entity) {
    this.substance?.enter(entity);
  }

  update() {
    this.type.update(this);
    this.substance?.update();
  }

  setSubstance(substance: Substance) {
    this.substance = substance;
    substance.tile = this;
    substance.create();
  }

  removeSubstance() {
    this.substance = undefined;
  }
}

export type UpdateResult =
  | boolean // sync action
  | Promise<boolean> // async action

export const Speeds = {
  Never: 0,
  EveryTurn: ENERGY_REQUIRED_PER_TURN,
  Every2Turns: ENERGY_REQUIRED_PER_TURN / 2,
  Every3Turns: ENERGY_REQUIRED_PER_TURN / 3,
  Every4Turns: ENERGY_REQUIRED_PER_TURN / 4,
  Every6Turns: ENERGY_REQUIRED_PER_TURN / 6,
};

export const StatusGlyphs = {
  Stunned: Glyph(Chars.Stun, Colors.Grey3),
  Alerted: Glyph("!", Colors.Red),
  Attacking: Glyph(Chars.Sword, Colors.Red),
  North: Glyph(Chars.North, Colors.Red),
  South: Glyph(Chars.South, Colors.Red),
  West: Glyph(Chars.West, Colors.Red),
  East: Glyph(Chars.East, Colors.Red),
  NorthEast: Glyph(Chars.NorthEast, Colors.Red),
  NorthWest: Glyph(Chars.NorthWest, Colors.Red),
  SouthEast: Glyph(Chars.SouthWest, Colors.Red),
  SouthWest: Glyph(Chars.SouthWest, Colors.Red),
};

export class DamageType {
  name: string;
  description: string;
  glyph: Glyph;

  constructor(glyph: Glyph, name: string, description: string) {
    this.glyph = glyph;
    this.name = name;
    this.description = description;
  }

  static Generic = new DamageType(
    Glyph(Chars.Sword, Colors.Grey3),
    "Damage",
    ""
  );

  static Chain = new DamageType(
    Glyph(Chars.ChainLinkHorizontal, Colors.Grey3),
    "Chain",
    ""
  );

  static Healing = new DamageType(
    Glyph(Chars.Heart, Colors.Red),
    "Healing",
    ""
  );

  static Fire = new DamageType(
    Glyph(Chars.Fire, Colors.Orange, Colors.Red2),
    "Fire",
    ""
  );

  static Trap = new DamageType(
    Glyph("*", Colors.Grey3),
    "Trap",
    ""
  );

  static Fist = new DamageType(
    Glyph(Chars.Fist, Colors.Grey3),
    "Melee",
    ""
  );

  static Poison = new DamageType(
    Glyph(Chars.Droplet, Colors.Green),
    "Poison",
    ""
  );

  static Explosion = new DamageType(
    Glyph(Chars.Fire, Colors.Orange4),
    "Explosion",
    ""
  );
}

export function isDamageType(value: any): value is DamageType {
  return Object.values(DamageType).includes(value);
}

export interface Damage {
  amount: number;
  type: DamageType;
  vector?: Vector.Vector;
  knockback?: boolean;
  statuses?: Status[];
  dealer?: Entity;
  entity?: Entity;
}

export interface Attack {
  attacker: Entity;
  damage: Damage;
}

export interface Stat {
  current: number;
  max: number;
}

export abstract class Status extends EventHandler {
  abstract name: string;
  abstract description: string;
  abstract glyph: Glyph;
  entity: Entity = null!;
  turns: number;
  onAdded() {}
  onRemoved() {}
  onUpdate() {}

  constructor(turns: number = Infinity) {
    super();
    this.turns = turns;
  }

  modifyGlyph(glyph: Glyph): Glyph {
    return glyph;
  }

  update() {
    this.turns -= 1;
    this.onUpdate();
  }
}

export type StatusType = Constructor<Status>;

export function Stat(current: number, max: number = current): Stat {
  return { current, max };
}

export abstract class Entity extends EventHandler {
  level: Level = null!;
  pos: Point.Point = { x: 0, y: 0 };
  hp?: Stat;
  speed = 0;
  energy = 0;
  parent: Entity | undefined;
  pushable = false;
  interactive = false;
  intentGlyph: Glyph | undefined;
  immunities: StatusType[] = [];
  statuses: Status[] = [];
  flying = false;
  dead = false;
  heavy = false;
  visionDistance = 10;
  skipNextTurn = false;
  didMove = false;

  abstract glyph: Glyph;
  abstract name: string;
  abstract description: string;

  getTile() {
    return this.level.getTile(this.pos.x, this.pos.y)!;
  }

  getIntentGlyph(): Glyph | undefined {
    return this.intentGlyph;
  }

  getStatusGlyph() {
    let glyph = this.glyph;

    for (let status of this.statuses) {
      glyph = status.modifyGlyph(glyph);
    }

    return glyph;
  }

  renderTargets(terminal: Terminal) {}

  onEvent(event: GameEvent): void {
    for (let status of this.statuses) {
      event.sendTo(status);
    }
  }

  addStatus(status: Status): boolean {
    let type = status.constructor as StatusType;

    if (this.immunities.includes(type)) {
      return false;
    }

    let existing = this.getStatus(type);

    if (existing) {
      existing.turns += status.turns;
      status = existing;
    } else {
      this.statuses.push(status);
      status.entity = this;
      status.onAdded();
    }

    new StatusAddedEvent(this, status || existing).dispatch();
    return true;
  }

  removeStatus(status: Status) {
    status.onRemoved();
    status.entity = undefined!;
    this.statuses.splice(this.statuses.indexOf(status), 1);
    new StatusRemovedEvent(this, status).dispatch();
  }

  removeStatusType(statusType: StatusType) {
    let status = this.getStatus(statusType);
    if (status) return this.removeStatus(status);
  }

  gainEnergy() {
    this.energy += this.speed;
  }

  canTakeTurn() {
    if (this.skipNextTurn) {
      return false;
    } else {
      return this.energy >= ENERGY_REQUIRED_PER_TURN;
    }
  }

  attack(target: Entity, damage: Damage) {
    new DealDamageEvent(this, target, damage).dispatch();
    target.attacked({ damage, attacker: this });
  }

  attacked(attack: Attack) {
    this.applyDamage(attack.damage, attack.attacker);
  }

  applyDamage(damage: Damage, dealer?: Entity) {
    if (this.hp == null) return;

    new TakeDamageEvent(this, damage, dealer).dispatch();

    if (damage.statuses) {
      for (let status of damage.statuses) {
        this.addStatus(status);
      }
    }

    if (damage.vector && damage.knockback && !this.heavy) {
      this.moveBy(damage.vector, { forced: true });
    }

    this.hp.current = clamp(0, this.hp.current - damage.amount, this.hp.max);

    if (this.hp.current <= 0) {
      this.die(damage, dealer);
    }
  }

  die(damage?: Damage, killer?: Entity) {
    if (this.dead) {
      return;
    }

    this.dead = true;

    if (killer) {
      new KillEvent(killer, this, damage).dispatch();
    }

    new DeathEvent(this, damage, killer).dispatch();

    if (this.dead) {
      this.despawn();
    }
  }

  despawn() {
    this.level.removeEntity(this);
    new DespawnEvent(this).dispatch();
  }

  hasStatus(type: StatusType): boolean {
    return this.statuses.some(status => status instanceof type);
  }

  getStatus<S extends Status>(type: Constructor<S>): S | undefined {
    return this.statuses.find(status => status instanceof type) as S;
  }

  resetEnergy() {
    this.energy -= ENERGY_REQUIRED_PER_TURN;
  }

  takeTurn(): UpdateResult {
    return true;
  }

  protected onUpdate() {}

  async update() {
    let result: UpdateResult = true;
    this.skipNextTurn = false;

    this.onUpdate();
    this.gainEnergy();
    this.updateStatuses();

    if (this.canTakeTurn()) {
      this.resetEnergy();
      result = await this.takeTurn();
    }

    return result;
  }

  updateStatuses() {
    for (let status of this.statuses) {
      status.update();

      if (status.turns <= 0) {
        this.removeStatus(status);
      }
    }
  }

  moveBy(vec: Vector.Vector, options = defaultMovementOptions) {
    return this.moveTo(this.pos.x + vec[0], this.pos.y + vec[1], options);
  }

  moveIn(direction: Direction.Direction, options = defaultMovementOptions) {
    let vec = directionToGridVector(direction);
    return this.moveBy(vec, options);
  }

  moveTowards(target: Entity, options = defaultMovementOptions) {
    let dx = target.pos.x - this.pos.x;
    let dy = target.pos.y - this.pos.y;
    return Math.abs(dx) > Math.abs(dy)
      ? this.moveBy([Math.sign(dx), 0], options)
      : this.moveBy([0, Math.sign(dy)], options);
  }

  moveAway(target: Entity, options = defaultMovementOptions) {
    let dx = this.pos.x - target.pos.x;
    let dy = this.pos.x - target.pos.y;
    return Math.abs(dx) > Math.abs(dy)
      ? this.moveBy([Math.sign(dx), 0], options)
      : this.moveBy([0, Math.sign(dy)], options);
  }

  moveTowardsWithDiagonals(target: Entity, options = defaultMovementOptions) {
    let dx = target.pos.x - this.pos.x;
    let dy = target.pos.y - this.pos.y;
    return this.moveBy([Math.sign(dx), Math.sign(dy)], options);
  }

  canMoveOntoTile(tile: Tile, options: MovementOptions) {
    return (
      // Flying entities can always move onto flyable tiles
      (tile.type.flyable && this.flying) ||
      // Walking entities will only move into liquid if forced
      (tile.type.liquid && options.forced) ||
      // Otherwise, just check whether the tile is walkable
      (tile.type.walkable)
    );
  }

  moveTo(x: number, y: number, options = defaultMovementOptions) {
    this.didMove = false;

    // Moves to a tile we're already on are pointless
    if (x === this.pos.x && y === this.pos.y) return false;

    let tile = this.level.getTile(x, y);
    let startPos = Point.clone(this.pos);
    let endPos = Point.from(x, y);

    // Check to see whether anything might be preventing us from moving
    let tryMoveEvent = new TryMoveEvent(this, startPos, endPos);

    tryMoveEvent.dispatch();

    switch (tryMoveEvent.status) {
      case "blocked":
        return true;
      case "failed":
        return false;
    }

    // Check whether this entity can move onto this tile.
    if (tile == null || !this.canMoveOntoTile(tile, options)) {
      if (tile) {
        // If there is a tile there but they can't move onto it, fire off
        // a "bump" event just in case there's something else they can do
        // (e.g. digging it, or interacting with it).
        let event = new TileBumpEvent(this, tile).dispatch();
        return event.succeeded;
      } else {
        return false;
      }
    }

    // Attempt to melee any entities stood here
    let entities = this.level.getEntitiesAt(x, y);

    if (entities.length) {
      for (let entity of entities) {
        if (entity.interactive && this.canInteract()) {
          new InteractEvent(this, entity).dispatch();
          continue;
        }

        if (entity.pushable) {
          new PushEvent(this, entity).dispatch();
          continue;
        }

        let damage = this.getMeleeDamage();
        if (damage == null) continue;

        let vec = Vector.fromPoints(this.pos, { x, y });
        Vector.normalize(vec);
        damage.vector = vec.map(Math.round) as Vector.Vector;

        this.attack(entity, damage);
      }

      return true;
    }

    let fromPoint = Point.clone(this.pos);
    let toPoint = Point.from(x, y);
    let previousTile = this.getTile()!;

    new TileExitEvent(this, previousTile).dispatch();
    new MoveEvent(this, fromPoint, toPoint).dispatch();
    new TileEnterEvent(this, tile).dispatch();
    tile.enter(this);

    this.pos.x = x;
    this.pos.y = y;
    this.didMove = true;

    return true
  }

  getMeleeDamage(): Damage | null {
    return null;
  }

  distanceTo(entity: Entity): number {
    return Point.distance(this.pos, entity.pos);
  }

  canInteract() {
    return this instanceof Player;
  }

  canSee(entity: Entity) {
    if (entity.dead) {
      return false;
    }

    if (this.distanceTo(entity) > this.visionDistance) {
      return false;
    }

    let line = Line.fromPoints(this.pos, entity.pos);

    return Raster
      .strokeLine(line)
      .every(pos => {
        let tile = this.level.getTile(pos.x, pos.y);
        return tile?.type.walkable;
      });
  }
}

export type PlayerAction =
  | { type: "rest" }
  | { type: "move", x: number, y: number }
  | { type: "use", target: Direction.Direction | Entity | undefined }

export class Player extends Entity {
  name = "You";
  description = "";
  glyph = Glyph(Chars.Creature, Colors.White);
  speed = Speeds.EveryTurn;
  hp = Stat(10);
  molten = false;
  ability: Ability | undefined;
  vestiges: Vestige[] = [];
  hasKey: boolean = false;
  currency = 0;

  onEvent(event: GameEvent): void {
    super.onEvent(event);

    for (let vestige of this.vestiges) {
      event.sendTo(vestige);
    }

    if (this.ability) {
      event.sendTo(this.ability);
    }
  }

  addCurrency(amount: number) {
    let event = new GainCurrencyEvent(amount);
    event.dispatch();
    this.currency += event.amount;
  }

  setAbility(ability: Ability) {
    this.ability = ability;
    this.ability.owner = this;
  }

  addVestige(vestige: Vestige) {
    this.vestiges.push(vestige);
    vestige.owner = this;
    vestige.onAdded();
    new VestigeAddedEvent(this, vestige).dispatch();
  }

  updateVestiges() {
    for (let vestige of this.vestiges) {
      vestige.onUpdate();
    }
  }

  update() {
    this.updateVestiges();
    return super.update();
  }

  setNextAction(action: PlayerAction): void {}

  private waitForNextAction() {
    return new Promise<PlayerAction>(resolve => {
      this.setNextAction = resolve;
    });
  }

  async takeTurn() {
    let action = await this.waitForNextAction();

    switch (action.type) {
      case "move":
        return this.moveBy([action.x, action.y]);
      case "rest":
        return true;
      case "use":
        return this.useAbility(action.target);
      default:
        return false;
    }
  }

  useAbility(target: Direction.Direction | Entity | undefined): boolean {
    if (this.ability == null) {
      return false;
    }

    if (this.ability.canUse() === false) {
      return false;
    }

    return this.ability.use(target);
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Fist,
      amount: 2,
    };
  }
}

export abstract class Substance extends EventHandler {
  abstract fg: number;
  abstract bg: number;
  defaultTimer = 5;
  char: string | undefined;
  tile: Tile = undefined!;
  timer: number = 0;

  constructor(timer?: number) {
    super();
    this.timer = timer ?? 0;
  }

  abstract applyTo(entity: Entity): void;

  create() {
    if (this.timer === 0) {
      this.timer = this.defaultTimer;
    }

    this.onCreate();
  }

  enter(entity: Entity) {
    this.applyTo(entity);
    this.tile.removeSubstance();
    this.onEnter(entity);
  }

  update() {
    this.timer -= 1;
    if (this.timer <= 0) {
      this.tile.removeSubstance();
      this.remove();
    } else {
      this.onUpdate();
    }
  }

  remove() {
    this.onRemove();
  }

  protected onEnter(entity: Entity) {}
  protected onCreate() {}
  protected onUpdate() {}
  protected onRemove() {}
}

export abstract class Ability extends EventHandler {
  owner: Player = undefined!;
  abstract name: string;
  abstract description: string;
  abstract glyph: Glyph;
  abstract targetingMode: TargetingMode;

  onUpdate(entity: Entity) {}
  canUse(): boolean { return true; }
  use(target?: Entity | Direction.Direction): boolean { return true; }
}

export type TargetingMode =
  | { type: "directional", range: number }
  | { type: "entity" }
  | { type: "none" }

export abstract class Vestige extends EventHandler {
  owner: Player = undefined!;
  abstract name: string;
  abstract description: string;
  abstract glyph: Glyph;
  abstract rarity: Rarity;

  onAdded() {}
  onRemoved() {}
  onUpdate() {}
}
