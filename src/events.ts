import { Damage, Entity, Level, Status, Tile, Vestige } from "./game";
import { Constructor } from "./helpers";

export abstract class GameEvent {
  protected abstract invoke(handler: EventHandler): void;
  abstract dispatch(...args: any[]): void;

  is<T extends GameEvent>(constructor: Constructor<T>): this is T {
    return this instanceof constructor;
  }

  sendTo(handler: EventHandler) {
    handler.onEvent(this);
    this.invoke(handler);
  }
}

export class EventHandler {
  onEvent(event: GameEvent) {}
  onTileEnter(event: TileEnterEvent) {};
  onTileExit(event: TileExitEvent) {};
  onTileBump(event: TileBumpEvent) {}
  onDealDamage(event: DealDamageEvent) {}
  onTakeDamage(event: TakeDamageEvent) {}
  onSpawn(event: SpawnEvent) {}
  onDespawn(event: DespawnEvent) {}
  onDeath(event: DeathEvent) {}
  onKill(event: KillEvent) {}
  onPush(event: PushEvent) {}
  onInteract(event: InteractEvent) {}
  onStatusAdded(event: StatusAddedEvent) {}
  onStatusRemoved(event: StatusRemovedEvent) {}
  onVestigeAdded(event: VestigeAddedEvent) {}
  onEnterLevel(event: EnterLevelEvent) {}
  onExitLevel(event: ExitLevelEvent) {}
  onGainCurrency(event: GainCurrencyEvent) {}
}

export class EnterLevelEvent extends GameEvent {
  constructor(readonly level: Level) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onEnterLevel(this);
  }

  dispatch() {
    this.sendTo(game.player);
    this.sendTo(game);
  }
}

export class ExitLevelEvent extends GameEvent {
  constructor(readonly level: Level) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onExitLevel(this);
  }

  dispatch() {
    this.sendTo(game.player);
    this.sendTo(game);
  }
}

export class TileEnterEvent extends GameEvent {
  constructor(readonly entity: Entity, readonly tile: Tile) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onTileEnter(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(this.tile.type);
    this.sendTo(game);
  }
}

export class TileExitEvent extends GameEvent {
  constructor(readonly entity: Entity, readonly tile: Tile) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onTileExit(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(this.tile.type);
    this.sendTo(game);
  }
}

export class TileBumpEvent extends GameEvent {
  constructor(readonly entity: Entity, readonly tile: Tile) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onTileBump(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(this.tile.type);
    this.sendTo(game);
  }
}

export class DealDamageEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly target: Entity,
    readonly damage: Damage,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onDealDamage(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class TakeDamageEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly damage: Damage,
    readonly dealer?: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onTakeDamage(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class SpawnEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onSpawn(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class DespawnEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onDespawn(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class DeathEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly damage?: Damage,
    readonly killer?: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onDeath(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class KillEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly target: Entity,
    readonly damage?: Damage,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onKill(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class PushEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly target: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onPush(this);
  }

  dispatch() {
    this.sendTo(this.target);
    this.sendTo(game);
  }
}

export class InteractEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly target: Entity,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onInteract(this);
  }

  dispatch() {
    this.sendTo(this.target);
    this.sendTo(game);
  }
}

export class StatusAddedEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly status: Status,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onStatusAdded(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class StatusRemovedEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly status: Status,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onStatusRemoved(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class VestigeAddedEvent extends GameEvent {
  constructor(
    readonly entity: Entity,
    readonly vestige: Vestige,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onVestigeAdded(this);
  }

  dispatch() {
    this.sendTo(this.entity);
    this.sendTo(game);
  }
}

export class GainCurrencyEvent extends GameEvent {
  constructor(
    public amount: number,
  ) {
    super();
  }

  invoke(handler: EventHandler) {
    return handler.onGainCurrency(this);
  }

  dispatch() {
    this.sendTo(game.player);
    this.sendTo(game);
  }
}
