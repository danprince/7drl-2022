import { RNG } from "silmarils";
import * as Entities from "./entities";
import { Entity, Level, Substance, Tile, TileType } from "./game";
import * as Tiles from "./tiles";

export type TileRule = (tile: Tile, level: Level) => boolean;

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
  rule?: TileRule;
  substance?: CreateSubstance;
}

export type LegendEntry = Omit<CellBuilder, "key">;

export interface Legend {
  [key: string]: LegendEntry;
}

export const getDefaultFloor: CreateTile = level =>
  level.type.characteristics.defaultFloorTile;

export const getDefaultWall: CreateTile = level =>
  level.type.characteristics.defaultWallTile;

export const getDefaultLiquid: CreateTile = level =>
  level.type.characteristics.defaultLiquidTile;

export const getOrganicFloor: CreateTile = level =>
  RNG.item(Tiles.Grass);

export const isWalkable: TileRule = tile =>
  tile.type.walkable;

export const isLiquid: TileRule = tile =>
  tile.type.liquid;

export const isDefaultWall: TileRule = (tile, level) =>
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
  '"': {
    tile: getOrganicFloor,
  },
  "+": {
    rule: isWalkable,
  },
  "#": {
    tile: getDefaultWall,
  },
  ",": {
    tile: getDefaultFloor,
    rule: isWalkable,
  },
  "%": {
    rule: isDefaultWall,
  },
  //"$": {
  //  tile: getDefaultFloor,
  //  spawn: () => new Entities.Chest(),
  //},
  "?": {
    rule: isWalkable,
    spawn: getRandomEntity,
  },
  "C": {
    rule: isWalkable,
    spawn: getCommonEntity,
  },
  "B": {
    rule: isWalkable,
    spawn: getUncommonEntity,
  },
  "A": {
    rule: isWalkable,
    spawn: getRareEntity,
  },
  "X": {
    rule: tile => tile.type === Tiles.Doorway,
  },
  //"L": {
  //  tile: getDefaultFloor,
  //  spawn: () => new Entities.Lever(),
  //},
  //"O": {
  //  tile: getDefaultFloor,
  //  spawn: () => new Entities.Boulder(),
  //},
  "~": {
    tile: getDefaultLiquid,
  },
  "≈": {
    rule: isLiquid,
  },
  //"o": {
  //  tile: getObstacleTile,
  //},
  "=": {
    tile: Tiles.IronBars,
  },
  "^": {
    tile: Tiles.Fissure,
  },
  "P": {
    // TODO: Pressure plate
  },
  "@": {
    // TODO: Miniboss
  },
};
