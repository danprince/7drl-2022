import { Direction, Line, Point, Raster, Rectangle, RNG, Vector } from "silmarils";
import { DealDamageEvent, DeathEvent, dispatch, EventHandler, GameEvent, KillEvent, StatusAddedEvent, StatusRemovedEvent, TakeDamageEvent, TileEnterEvent, VestigeAddedEvent } from "./events";
import { Glyph, Terminal } from "./terminal";
import { Colors, UI } from "./ui";

const ENERGY_REQUIRED_PER_TURN = 12;

export type GameMessageComponent = string | number | Entity | DamageType | Status | Tile;
export type GameMessage = GameMessageComponent[];

export class Game extends EventHandler {
  ui: UI = null!;
  level: Level = null!;
  player: Player = null!;
  messages: GameMessage[] = [];
  handlers: EventHandler[] = [];

  onEvent(event: GameEvent): void {
    for (let handler of this.handlers) {
      dispatch(handler, event);
    }
  }

  async* update(): AsyncGenerator<number, void> {
    // Only update the entities that existed at the start of this turn
    let entities = [...this.level.entities];

    for (let tile of this.level.tiles) {
      tile?.update();
    }

    for (let entity of entities) {
      if (entity.dead) continue;

      await entity.update();

      while (this.level.effects.length) {
        let effects = this.level.effects;
        this.level.effects = [];

        for (let effect of effects) {
          yield* effect;
        }
      }
    }

    yield 1;
  }

  log(...message: GameMessage) {
    this.messages.push(message);
  }
}

export type Effect = Generator<number, void>;

export type FX = (terminal: Terminal) => void;

export class Level {
  game: Game;
  width: number;
  height: number;
  entities: Entity[] = [];
  tiles: (Tile | undefined)[] = [];
  fx: FX[] = [];
  effects: Effect[] = [];

  constructor(game: Game, width: number, height: number) {
    this.game = game;
    this.width = width;
    this.height = height;
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
    this.entities.push(entity);
    entity.level = this;
  }

  removeEntity(entity: Entity) {
    this.entities.splice(this.entities.indexOf(entity), 1);
  }

  getEntitiesAt(x: number, y: number) {
    return this.entities.filter(entity => {
      return entity.pos.x === x && entity.pos.y === y;
    });
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

  isEmpty(x: number, y: number) {
    let tile = this.getTile(x, y);
    if (tile == null) return false;
    if (!tile.type.walkable) return false;
    let entities = this.getEntitiesAt(x, y);
    return entities.length === 0;
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

type TileTypeProps = {
  walkable: TileType["walkable"];
  glyph: TileType["glyph"];
  autotiling?: TileType["autotiling"];
  onEnter?: TileType["onEnter"];
  onUpdate?: TileType["onUpdate"];
}

export class TileType extends EventHandler {
  glyph: Glyph | VariantGlyph;
  autotiling?: string[];
  walkable: boolean;

  constructor(props: TileTypeProps) {
    super();
    this.glyph = props.glyph;
    this.autotiling = props.autotiling;
    this.walkable = props.walkable;
    this.onEnter = props.onEnter ? props.onEnter : this.onEnter;
    this.onUpdate = props.onUpdate ? props.onUpdate : this.onUpdate;
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

  onEnter(entity: Entity, tile: Tile) {}
  onUpdate(entity: Entity, tile: Tile) {}
}

export class Tile {
  level: Level = null!;
  pos: Point.Point = { x: 0, y: 0};
  type: TileType;
  glyph: Glyph;
  substance: Substance | undefined;

  constructor(type: TileType) {
    this.type = type;
    this.glyph = type.assignGlyph();
  }

  update() {
    this.substance?.update();
  }

  setSubstance(substance: Substance) {
    this.substance = substance;
    substance.tile = this;
    substance.init();
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
  Stunned: Glyph("\x90", Colors.Grey3),
  Alerted: Glyph("!", Colors.Red),
  Attacking: Glyph("\x0b", Colors.Red),
  North: Glyph("\x0e", Colors.Red),
  South: Glyph("\x0f", Colors.Red),
  West: Glyph("\x0d", Colors.Red),
  East: Glyph("\x0c", Colors.Red),
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

  static Melee = new DamageType(
    Glyph("\xa1", Colors.Grey3),
    "Melee",
    ""
  );

  static Poison = new DamageType(
    Glyph("\x07", Colors.Green),
    "Poison",
    ""
  );

  static Explosion = new DamageType(
    Glyph("\xa5", Colors.Orange4),
    "Explosion",
    ""
  );

  static Stone = new DamageType(
    Glyph("\x81", Colors.Grey3),
    "Stone",
    ""
  );

  static Misc = new DamageType(
    Glyph("\x0b", Colors.Grey3),
    "Damage",
    ""
  );
}

export function isDamageType(value: any): value is DamageType {
  return Object.values(DamageType).includes(value);
}

export interface Damage {
  amount: number;
  type: DamageType;
  direction?: Vector.Vector;
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
  turns: number = Infinity;
  onAdded() {}
  onRemoved() {}
  onUpdate() {}

  update() {
    this.turns -= 1;
    this.onUpdate();
  }
}

export type Constructor<T> = { new(...args: any[]): T };
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
  statusGlyph: Glyph | undefined;
  statuses: Status[] = [];
  dead = false;
  heavy = false;
  visionDistance = 10;
  skipNextTurn = false;
  vestiges: Vestige[] = [];

  abstract glyph: Glyph;
  abstract name: string;
  abstract description: string;

  getTile() {
    return this.level.getTile(this.pos.x, this.pos.y);
  }

  onEvent(event: GameEvent): void {
    for (let vestige of this.vestiges) {
      dispatch(vestige, event);
    }

    for (let status of this.statuses) {
      dispatch(status, event);
    }
  }

  addVestige(vestige: Vestige) {
    this.vestiges.push(vestige);
    vestige.owner = this;
    vestige.onAdded();
    VestigeAddedEvent(this, vestige);
  }

  addStatus(status: Status) {
    let existing = this.getStatus(status.constructor as any);

    if (existing) {
      existing.turns += status.turns;
      status = existing;
    } else {
      this.statuses.push(status);
      status.entity = this;
      status.onAdded();
    }

    StatusAddedEvent(this, status || existing);
  }

  removeStatus(status: Status) {
    status.onRemoved();
    status.entity = undefined!;
    this.statuses.splice(this.statuses.indexOf(status), 1);
    StatusRemovedEvent(this, status);
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
    DealDamageEvent(this, target, damage);
    target.attacked({ damage, attacker: this });
  }

  attacked(attack: Attack) {
    this.applyDamage(attack.damage, attack.attacker);
  }

  applyDamage(damage: Damage, dealer?: Entity) {
    if (this.hp == null) return;

    TakeDamageEvent(this, damage, dealer);

    if (damage.statuses) {
      for (let status of damage.statuses) {
        this.addStatus(status);
      }
    }

    if (damage.direction && damage.knockback && !this.heavy) {
      this.moveBy(damage.direction[0], damage.direction[1]);
    }

    this.hp.current = Math.max(this.hp.current - damage.amount, 0);

    if (this.hp.current <= 0) {
      this.die(damage, dealer);
    }
  }

  die(damage?: Damage, killer?: Entity) {
    this.dead = true;

    if (killer) {
      KillEvent(killer, this, damage);
    }

    DeathEvent(this, damage, killer);

    if (this.dead) {
      this.level.removeEntity(this);
    }
  }

  hasStatus(type: StatusType): boolean {
    return this.statuses.some(status => status instanceof type);
  }

  getStatus<S extends Status>(type: Constructor<S>): S | undefined {
    return this.statuses.find(status => status instanceof type) as S;
  }

  resetEnergy() {
    this.energy = 0;
  }

  takeTurn(): UpdateResult {
    return true;
  }

  tryTakeTurn(): UpdateResult {
    return this.takeTurn();
  }

  async update() {
    let result: UpdateResult = true;
    this.skipNextTurn = false;

    this.gainEnergy();
    this.updateVestiges();
    this.updateStatuses();

    if (this.canTakeTurn()) {
      this.resetEnergy();
      result = await this.tryTakeTurn();
    }

    return result;
  }

  updateVestiges() {
    for (let vestige of this.vestiges) {
      vestige.onUpdate();
    }
  }

  updateStatuses() {
    for (let status of this.statuses) {
      status.update();

      if (status.turns <= 0) {
        this.removeStatus(status);
      }
    }
  }

  moveBy(x: number, y: number) {
    return this.moveTo(this.pos.x + x, this.pos.y + y);
  }

  moveIn(direction: Direction.Direction) {
    let [dx, dy] = Direction.toVector(direction);
    return this.moveBy(dx, dy);
  }

  moveTowards(target: Entity) {
    let dx = target.pos.x - this.pos.x;
    let dy = target.pos.y - this.pos.y;
    return Math.abs(dx) > Math.abs(dy)
      ? this.moveBy(Math.sign(dx), 0)
      : this.moveBy(0, Math.sign(dy));
  }

  moveAway(target: Entity) {
    let dx = this.pos.x - target.pos.x;
    let dy = this.pos.x - target.pos.y;
    return Math.abs(dx) > Math.abs(dy)
      ? this.moveBy(Math.sign(dx), 0)
      : this.moveBy(0, Math.sign(dy));
  }

  moveTowardsWithDiagonals(target: Entity) {
    let dx = target.pos.x - this.pos.x;
    let dy = target.pos.y - this.pos.y;
    return this.moveBy(Math.sign(dx), Math.sign(dy));
  }

  moveTo(x: number, y: number) {
    // Moves to a tile we're already on are pointless
    if (x === this.pos.x && y === this.pos.y) return false;

    // Check whether there is a walkable tile
    let tile = this.level.getTile(x, y);

    // Can't walk into void tiles
    if (tile == null) return false;

    // Can't walk into solid tiles
    if (tile.type.walkable === false) {
      dispatch(this, { type: "tile-bump", tile, entity: this });
      return false;
    }

    // Attempt to melee any entities stood here
    let entities = this.level.getEntitiesAt(x, y);

    if (entities.length) {
      for (let entity of entities) {
        let damage = this.getMeleeDamage();
        if (damage == null) continue;

        let vec = Vector.fromPoints(this.pos, { x, y });
        Vector.normalize(vec);
        damage.direction = vec.map(Math.round) as Vector.Vector;

        dispatch(this, {
          type: "deal-damage",
          entity: this,
          damage,
          target: entity,
        });

        this.attack(entity, damage);
      }

      return true;
    }

    this.pos.x = x;
    this.pos.y = y;
    // TODO:
    tile.substance?.onEnter(this);
    tile.type.onEnter(this, tile);
    TileEnterEvent(this, tile);

    return true
  }

  getMeleeDamage(): Damage | null {
    return null;
  }

  distanceTo(entity: Entity): number {
    return Point.distance(this.pos, entity.pos);
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
  glyph = Glyph("\x10", Colors.White);
  speed = Speeds.EveryTurn;
  hp = { current: 3, max: 3 };
  molten = false;
  ability: Ability | undefined;

  onEvent(event: GameEvent): void {
    if (this.ability) {
      dispatch(this.ability, event);
    }
  }

  setAbility(ability: Ability) {
    this.ability = ability;
    this.ability.owner = this;
  }

  async tryTakeTurn() {
    while (true) {
      let result = await this.takeTurn();
      if (result) return result;
    }
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
        return this.moveBy(action.x, action.y);
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
      type: DamageType.Melee,
      amount: 1,
    };
  }
}

export abstract class Substance extends EventHandler {
  abstract fg: number;
  abstract bg: number;
  abstract defaultTimer: number;
  tile: Tile = undefined!;
  timer: number = 0;

  init() {
    this.timer = this.defaultTimer;
  }

  update() {
    this.timer -= 1;
    if (this.timer <= 0) {
      this.tile.removeSubstance();
    }
  }

  onEnter(entity: Entity) {}
  onExit(entity: Entity) {}
  onUpdate(entity: Entity) {}
}

export abstract class Ability extends EventHandler {
  owner: Player = undefined!;
  abstract name: string;
  abstract description: string;
  abstract glyph: Glyph;
  abstract targeting: TargetingMode;

  onUpdate(entity: Entity) {}
  canUse(): boolean { return false; }
  use(target?: Entity | Direction.Direction): boolean { return true; }
}

export enum TargetingMode {
  Directional = "directional",
  Entity = "entity",
  None = "none",
}

export abstract class Vestige extends EventHandler {
  owner: Entity = undefined!;
  abstract name: string;
  abstract description: string;
  abstract glyph: Glyph;

  onAdded() {}
  onRemoved() {}
  onUpdate() {}
}