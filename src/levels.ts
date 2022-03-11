import { LevelType } from "./game";
import * as Tiles from "./tiles";
import * as Entities from "./entities";

export let Caverns = new LevelType({
  name: "Caverns",
  characteristics: {
    defaultFloorTile: Tiles.Cobblestone,
    defaultWallTile: Tiles.BoneWall,
    defaultLiquidTile: Tiles.Lava,
    commonEntityTypes: [Entities.PunchingBag],
    uncommonEntityTypes: [Entities.PunchingBag],
    rareEntityTypes: [Entities.PunchingBag],
  },
});