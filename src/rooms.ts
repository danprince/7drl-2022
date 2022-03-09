import { RNG } from "silmarils";
import { RoomBuilder, Rarity } from "./builders";
import { getDirectionBetween } from "./helpers";
import * as Entities from "./entities";
import * as Tiles from "./tiles";
import * as Levels from "./levels";
import * as Substances from "./substances";
import * as Legend from "./legend";

export let RollingBoulder = new RoomBuilder("rolling-boulder", `
+++
+O+
*.*
*.*
*.*
*L*
`, {
  levelTypes: [Levels.PrimordialCaverns],
  rarity: Rarity.Uncommon,
  afterBuild(ctx) {
    let lever = ctx.findEntity<Entities.Lever>("L");
    let boulder = ctx.findEntity<Entities.Boulder>("O");
    lever.triggers = () => {
      if (!boulder.hasBeenPushed) {
        let dir = getDirectionBetween(boulder.pos, lever.pos);
        boulder.push(dir);
      } else {
        game.log("Nothing happens");
      }
    };
  }
});

export let JailCell = new RoomBuilder("jail-cell", `
#%%%#
#...#
#.?.#
#...#
##=##
`, {
  legend: {
    "=": {
      tile: Tiles.IronBars,
      constraint: tile => tile.type.walkable,
    },
  },
});

export let MountedBallista = new RoomBuilder("mounted-ballista", `
+++
+B+
+++
`, {
  rarity: Rarity.Rare,
  legend: {
    "B": {
      spawn: () => new Entities.Ballista(),
    },
  },
});

export let SealedVault = new RoomBuilder("sealed-vault", `
.###.
##$##
.###.
`, {
  levelTypes: [Levels.PrimordialCaverns],
});

export let SnakePit = new RoomBuilder("snake-pit", `
.........
.#~~.~#..
#~~s~~~#.
#~~~$~s~.
.#~s~~~#.
.#~~.~#s.
..#......
`, {
  rarity: Rarity.Uncommon,
  legend: {
    "~": {
      tile: Legend.getDefaultFloor,
      substance: () => new Substances.Slime(Infinity),
    },
    "s": {
      tile: Legend.getDefaultFloor,
      substance: () => new Substances.Slime(Infinity),
      spawn: () => new Entities.Snake(),
    },
  },
});

export let Monolith = new RoomBuilder("monolith", `
.........
....#....
...###...
..#####..
...###...
....#....
.........
`, {
  rarity: Rarity.Common,
});

export let OpenVault = new RoomBuilder("open-vault", `
#%%%%%#
##...##
#..$..#
##...##
###.###
**.+.**
`, {
  rarity: Rarity.Common,
});

export let MushroomCave = new RoomBuilder("mushroom-cave", `
#%%%%%#
##.m.##
#m.m.m#
##..m##
###.###
**.+.**
`, {
  rarity: Rarity.Uncommon,
  legend: {
    "m": {
      tile: Tiles.Floor,
      spawn: () => RNG.item(
        new Entities.MushroomBolete(),
        new Entities.MushroomDeceiver(),
      ),
    },
  },
});
