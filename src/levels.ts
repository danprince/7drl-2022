import { RNG } from "silmarils";
import { LevelType } from "./game";
import { TileMarker } from "./builders";
import * as Tiles from "./tiles";
import * as Entities from "./entities";

export let PrimordialCaverns = new LevelType({
  name: "Primordial Caverns",
  characteristics: {
    defaultFloorTile: Tiles.Floor,
    defaultWallTile: Tiles.Wall,
    commonEntityTypes: [Entities.Stoneshell],
    uncommonEntityTypes: [Entities.Boar],
    rareEntityTypes: [Entities.FossilKnight],
    decorativeEntityTypes: [Entities.MushroomBolete],
    obstacleTiles: [Tiles.Stalagmite],
  },
  build(builder) {
    return builder
      .noise(RNG.float(0.3, 0.5))
      .cellularAutomata({
        iterations: 20,
        rules: [[5, 6, 7, 8], [3, 4, 5, 6, 7, 8]],
        outOfBoundsMarker: TileMarker.Wall,
      })
      .build();
  },
});
