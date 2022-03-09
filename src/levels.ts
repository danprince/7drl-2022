import { LevelType } from "./game";
import { TileMarker } from "./builders";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import { RNG } from "silmarils";

export let PrimordialCaverns = new LevelType({
  name: "Primordial Caverns",
  floorTiles: [Tiles.Floor],
  wallTiles: [Tiles.Wall],
  commonEntities: [
    Entities.FossilKnight
  ],
  uncommonEntities: [],
  rareEntities: [],
  build(builder) {
    return builder
      //.fill(TileMarker.Floor)
      //.addPerimeterWall()
      .noise(RNG.float(0.3, 0.5))
      .cellularAutomata({
        iterations: 20,
        rules: [[5, 6, 7, 8], [3, 4, 5, 6, 7, 8]],
        outOfBoundsMarker: TileMarker.Wall,
      })
      .createEntrance()
      .createExit()
      // TODO: Is mapper needed here if we have the floorTiles/wallTiles above?
      .build(marker => {
        switch (marker) {
          case TileMarker.Wall:
            return Tiles.Wall;
          case TileMarker.Floor:
            return Tiles.Floor;
        }
      });
  },
});
