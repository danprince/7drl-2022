import { RNG, Direction } from "silmarils";
import { LevelType } from "./game";
import { LevelBuilder, Symmetry, TileMarker } from "./builders";
import * as Tiles from "./tiles";
import * as Entities from "./entities";

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
      .fill(TileMarker.Wall)
      .noise(0.4)
      .cellularAutomata({
        iterations: 20,
        rules: [[6, 7, 8], [3, 4, 5, 6, 7, 8]],
        outOfBoundsMarker: TileMarker.Wall,
      })
      .build(marker => {
        switch (marker) {
          case TileMarker.Wall:
            return Tiles.Wall;
          case TileMarker.Exit:
            return Tiles.Doorway;
          case TileMarker.Floor:
            return Tiles.Floor;
        }
      });
  },
});
