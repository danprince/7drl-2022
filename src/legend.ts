import { RNG } from "silmarils";
import * as Entities from "./entities";
import { Entity, Level, Substance, Tile, TileType } from "./game";
import * as Tiles from "./tiles";

export type TileConstraint = (tile: Tile, level: Level) => boolean;

export type CreateTile =
  | TileType
  | ((level: Level) => TileType);

export type CreateEntity =
  | ((level: Level) => Entity);

export type CreateSubstance =
  | ((level: Level) => Substance);

export interface CellBuilder {
  key?: string;
  tile?: CreateTile;
  spawn?: CreateEntity;
  constraint?: TileConstraint;
  substance?: CreateSubstance;
}

export interface Legend {
  [key: string]: Omit<CellBuilder, "key">;
}

export const getDefaultFloor: CreateTile = level =>
  level.type.characteristics.defaultFloorTile;

export const getDefaultWall: CreateTile = level =>
  level.type.characteristics.defaultWallTile;

export const isWalkable: TileConstraint = tile =>
  tile.type.walkable;

export const isDefaultWall: TileConstraint = (tile, level) =>
  tile.type === level.type.characteristics.defaultWallTile;

export const getCommonEntity: CreateEntity = level =>
  new (RNG.element(level.type.characteristics.commonEntityTypes));

export const getUncommonEntity: CreateEntity = level =>
  new (RNG.element(level.type.characteristics.uncommonEntityTypes));

export const getRareEntity: CreateEntity = level =>
  new (RNG.element(level.type.characteristics.rareEntityTypes));

export const getRandomEntity: CreateEntity = level =>
  RNG.chance(0.05) ? getRareEntity(level) :
  RNG.chance(0.25) ? getUncommonEntity(level) :
  getCommonEntity(level);

export const defaultLegend: Legend = {
  "*": {},
  ".": {
    tile: getDefaultFloor,
  },
  "+": {
    constraint: isWalkable,
  },
  "#": {
    tile: getDefaultWall,
  },
  ",": {
    tile: getDefaultFloor,
    constraint: isWalkable,
  },
  "%": {
    constraint: isDefaultWall,
  },
  "$": {
    tile: getDefaultFloor,
    spawn: () => new Entities.Chest(),
  },
  "?": {
    constraint: isWalkable,
    spawn: getRandomEntity,
  },
  "C": {
    constraint: isWalkable,
    spawn: getCommonEntity,
  },
  "B": {
    constraint: isWalkable,
    spawn: getUncommonEntity,
  },
  "A": {
    constraint: isWalkable,
    spawn: getRareEntity,
  },
  "X": {
    constraint: tile => tile.type === Tiles.Doorway,
  },
  "L": {
    tile: getDefaultFloor,
    spawn: () => new Entities.Lever(),
  },
  "O": {
    tile: getDefaultFloor,
    spawn: () => new Entities.Boulder(),
  },
  "o": {
    // TODO: Small boulder
  },
  "P": {
    // TODO: Pressure plate
  },
  "@": {
    // TODO: Miniboss
  },
  "~": {
    // TODO: Default liquid
  },
};
