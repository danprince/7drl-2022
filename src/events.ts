import { Damage, Entity, Status, Tile, Vestige } from "./game";

interface BaseEvent {
  type: string;
}

export interface TileEnterEvent extends BaseEvent {
  type: "tile-enter";
  entity: Entity;
  tile: Tile;
}

export function TileEnterEvent(entity: Entity, tile: Tile) {
  let event: TileEnterEvent = { type: "tile-enter", entity, tile };
  dispatch(game, event);
  dispatch(entity, event);
  dispatch(tile.type, event);
}

export interface TileBumpEvent extends BaseEvent {
  type: "tile-bump";
  tile: Tile;
  entity: Entity;
}

export function TileBumpEvent(entity: Entity, tile: Tile) {
  let event: TileBumpEvent = { type: "tile-bump", entity, tile };
  dispatch(entity, event);
  dispatch(tile.type, event);
  dispatch(game, event);
}

export interface DealDamageEvent extends BaseEvent {
  type: "deal-damage";
  damage: Damage;
  entity: Entity;
  target: Entity;
}

export function DealDamageEvent(entity: Entity, target: Entity, damage: Damage) {
  let event: DealDamageEvent = { type: "deal-damage", entity, target, damage };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface TakeDamageEvent extends BaseEvent {
  type: "take-damage";
  damage: Damage;
  entity: Entity;
  dealer: Entity | undefined;
}

export function TakeDamageEvent(entity: Entity, damage: Damage, dealer?: Entity) {
  let event: TakeDamageEvent = { type: "take-damage", entity, damage, dealer };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface SpawnEvent extends BaseEvent {
  type: "spawn";
  entity: Entity;
}

export function SpawnEvent(entity: Entity) {
  let event: SpawnEvent = { type: "spawn", entity };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface DeathEvent extends BaseEvent {
  type: "death";
  entity: Entity;
  damage: Damage | undefined;
  killer: Entity | undefined;
}

export function DeathEvent(entity: Entity, damage?: Damage, killer?: Entity) {
  let event: DeathEvent = { type: "death", entity, damage, killer };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface KillEvent extends BaseEvent {
  type: "kill";
  entity: Entity;
  target: Entity;
  damage: Damage | undefined;
}

export function KillEvent(entity: Entity, target: Entity, damage?: Damage) {
  let event: KillEvent = { type: "kill", entity, damage, target };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface PushEvent extends BaseEvent {
  type: "push";
  entity: Entity;
  target: Entity;
}

export function PushEvent(entity: Entity, target: Entity) {
  let event: PushEvent = { type: "push", entity, target };
  dispatch(target, event);
  dispatch(game, event);
}

export interface StatusAddedEvent extends BaseEvent {
  type: "status-added";
  entity: Entity;
  status: Status;
}

export function StatusAddedEvent(entity: Entity, status: Status) {
  let event: StatusAddedEvent = { type: "status-added", entity, status };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface StatusRemovedEvent extends BaseEvent {
  type: "status-removed";
  entity: Entity;
  status: Status;
}

export function StatusRemovedEvent(entity: Entity, status: Status) {
  let event: StatusRemovedEvent = { type: "status-removed", entity, status };
  dispatch(entity, event);
  dispatch(game, event);
}

export interface VestigeAddedEvent extends BaseEvent {
  type: "vestige-added";
  entity: Entity;
  vestige: Vestige;
}

export function VestigeAddedEvent(entity: Entity, vestige: Vestige) {
  let event: VestigeAddedEvent = { type: "vestige-added", entity, vestige };
  dispatch(entity, event);
  dispatch(game, event);
}

export type GameEvent =
  | TileEnterEvent
  | TileBumpEvent
  | DealDamageEvent
  | TakeDamageEvent
  | SpawnEvent
  | DeathEvent
  | KillEvent
  | PushEvent
  | StatusAddedEvent
  | StatusRemovedEvent
  | VestigeAddedEvent;

export class EventHandler {
  onEvent(event: GameEvent) {}
  onTileEnter(event: TileEnterEvent) {};
  onTileBump(event: TileBumpEvent) {}
  onDealDamage(event: DealDamageEvent) {}
  onTakeDamage(event: TakeDamageEvent) {}
  onSpawn(event: SpawnEvent) {}
  onDeath(event: DeathEvent) {}
  onKill(event: KillEvent) {}
  onPush(event: PushEvent) {}
  onStatusAdded(event: StatusAddedEvent) {}
  onStatusRemoved(event: StatusRemovedEvent) {}
  onVestigeAdded(event: VestigeAddedEvent) {}
}

export function dispatch(handler: EventHandler, event: GameEvent) {
  handler.onEvent(event);

  switch (event.type) {
    case "tile-enter": return handler.onTileEnter?.(event);
    case "tile-bump": return handler.onTileBump?.(event);
    case "deal-damage": return handler.onDealDamage?.(event);
    case "take-damage": return handler.onTakeDamage?.(event);
    case "spawn": return handler.onSpawn?.(event);
    case "death": return handler.onDeath?.(event);
    case "kill": return handler.onKill?.(event);
    case "status-added": return handler.onStatusAdded?.(event);
    case "status-removed": return handler.onStatusRemoved?.(event);
    case "vestige-added": return handler.onVestigeAdded?.(event);
    case "push": return handler.onPush?.(event);
    default: console.error(`Invalid event`, event);
  }
}