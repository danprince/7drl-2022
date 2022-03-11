import { LevelType } from "./game";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import { Direction, PRNG } from "silmarils";
import { Marker, Spades, Symmetry } from "./digger";

export let Caverns = new LevelType({
  name: "Caverns",
  characteristics: {
    defaultFloorTile: Tiles.Cobblestone,
    defaultWallTile: Tiles.BoneWall,
    defaultLiquidTile: Tiles.Lava,
    defaultDoorTile: Tiles.Doorway,
    commonEntityTypes: [Entities.PunchingBag],
    uncommonEntityTypes: [Entities.PunchingBag],
    rareEntityTypes: [Entities.PunchingBag],
  },
  dig(digger, entrance) {
    digger.fill(Marker.Wall);

    // The first set of diggers go through the level with 1x1 spades and symmetry to
    // create some credible looking structures.
    digger.tunnels({
      start: entrance,
      iterations: 20,
      spawnChance: 0.4,
      deathChance: 0.02,
      mutationChance: 0.5,
      turnChance: 0.6,
      symmetry: Symmetry.Both,
      spades: [Spades.OneByOne],
      directions: Direction.CARDINAL_DIRECTIONS,
    });

    // Invert the symmetric tunnels to turn them into walls.
    digger.invert();

    // Erode those walls with a new generation of non-symmetrical diggers.
    digger.tunnels({
      start: entrance,
      iterations: 30,
      spawnChance: 0.4,
      deathChance: 0.01,
      mutationChance: 0.5,
      spades: [Spades.OneByOne, Spades.TwoByTwo, Spades.Cross],
      directions: Direction.CARDINAL_DIRECTIONS,
    });

    digger.addPerimeterWall();

    digger.noise();
    digger.cellularAutomata({
      rules: [[5, 6, 7, 8], [4, 5, 6, 7, 8]]
    });
  },
});