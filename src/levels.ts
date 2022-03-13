import { LevelType } from "./engine";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Terrains from "./terrains";

export let Caverns = new LevelType({
  name: "Caverns",
  dig: Terrains.cavernous,
  characteristics: {
    defaultFloorTile: Tiles.Cobblestone,
    defaultWallTile: Tiles.BoneWall,
    defaultLiquidTile: Tiles.Lava,
    defaultDoorTile: Tiles.Doorway,
    commonMonsterTypes: [Entities.Mantleshell, Entities.Stoneshell, Entities.ArrowTrap],
    uncommonMonsterTypes: [Entities.Boulder, Entities.Maguana],
    rareMonsterTypes: [Entities.Worm],
    baseMonsterSpawnChance: 0.02,
    maxRewards: 2,
    decorations: [],
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
    commonMonsterTypes: [Entities.Frog],
    uncommonMonsterTypes: [Entities.Slimeshell],
    rareMonsterTypes: [Entities.Worm],
    baseMonsterSpawnChance: 0.02,
    maxRewards: 3,
    decorations: [],
  },
});
