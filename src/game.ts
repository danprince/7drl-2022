import { Direction, Point } from "silmarils";
import { Glyph, Chars, Colors, Speeds } from "./common";
import { Level, GameMessage, Damage, DamageType, Entity, Stat } from "./engine";
import { EventHandler, GainCurrencyEvent, GameEvent, VestigeAddedEvent } from "./events";
import { MessageLogHandler } from "./handlers";

export enum Rarity {
  Common,
  Uncommon,
  Rare,
}

export class Game extends EventHandler {
  level: Level = null!;
  player: Player = null!;
  messages: GameMessage[] = [];
  turns: number = 0;
  floor: number = 0;
  vestigePool: Vestige[] = [];
  globalEventHandlers: EventHandler[] = [
    new MessageLogHandler()
  ];

  addVestigeToPool(vestige: Vestige) {
    this.vestigePool.push(vestige);
  }

  removeVestigeFromPool(vestige: Vestige) {
    this.vestigePool.splice(this.vestigePool.indexOf(vestige), 1);
  }

  onEvent(event: GameEvent): void {
    if (this.level) {
      event.sendTo(this.level);
    }

    for (let handler of this.globalEventHandlers) {
      event.sendTo(handler);
    }
  }

  setLevel(level: Level) {
    this.floor += 1;
    this.level = level;
    this.level.autotile();
    this.player.pos = Point.clone(level.entrancePoint);
    this.level.addEntity(this.player);
    this.level.enter();
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  log(...message: GameMessage) {
    this.messages.push(message);
  }

  async* update(): AsyncGenerator<number, void> {
    yield* this.level.update();
    // If the player is no longer acting then we need to put frames
    // in between turns to stay responsive.
    yield this.player.dead ? 10 : 0;
    this.turns += 1;
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

  canInteract(): boolean {
    return true;
  }

  canRetryTurn(): boolean {
    return true;
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