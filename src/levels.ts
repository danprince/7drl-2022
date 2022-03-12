import { LevelType } from "./game";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Terrains from "./terrains";
import { Marker } from "./digger";

export let Caverns = new LevelType({
  name: "Caverns",
  dig: Terrains.cavernous,
  characteristics: {
    defaultFloorTile: Tiles.Cobblestone,
    defaultWallTile: Tiles.BoneWall,
    defaultLiquidTile: Tiles.Lava,
    defaultDoorTile: Tiles.Doorway,
    commonMonsterTypes: [Entities.Slime],
    uncommonMonsterTypes: [Entities.UncommonSlime],
    rareMonsterTypes: [Entities.RareSlime],
    baseMonsterSpawnChance: 0.02,
    maxRewards: 2,
  },
});

export let Jungle = new LevelType({
  name: "Jungle",
  dig: Terrains.alien,
  characteristics: {
    defaultFloorTile: Tiles.JungleFloor,
    defaultWallTile: Tiles.JungleWall,
    defaultLiquidTile: Tiles.Lava,
    defaultDoorTile: Tiles.Doorway,
    commonMonsterTypes: [Entities.Slime],
    uncommonMonsterTypes: [Entities.UncommonSlime],
    rareMonsterTypes: [Entities.RareSlime],
    baseMonsterSpawnChance: 0.02,
    maxRewards: 3,
  },
});

export let Mantle = new LevelType({
  name: "Mantle",
  dig: Terrains.volcanic,
  characteristics: {
    defaultFloorTile: Tiles.VolcanicFloor,
    defaultWallTile: Tiles.VolcanicWall,
    defaultLiquidTile: Tiles.Lava,
    defaultDoorTile: Tiles.Doorway,
    commonMonsterTypes: [Entities.Slime],
    uncommonMonsterTypes: [Entities.UncommonSlime],
    rareMonsterTypes: [Entities.RareSlime],
    baseMonsterSpawnChance: 0.02,
    maxRewards: 4,
  },
});

export let Grasslands = new LevelType({
  name: "Grasslands",
  dig: digger => digger.fill(Marker.Floor),
  characteristics: {
    defaultFloorTile: Tiles.Grass,
    defaultWallTile: Tiles.VolcanicWall,
    defaultLiquidTile: Tiles.Water,
    defaultDoorTile: Tiles.Doorway,
    commonMonsterTypes: [Entities.Slime],
    uncommonMonsterTypes: [Entities.UncommonSlime],
    rareMonsterTypes: [Entities.RareSlime],
    baseMonsterSpawnChance: 0.0,
    maxRewards: 0,
  },
});
