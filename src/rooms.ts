import { RNG } from "silmarils";
import { Rarity, RoomBuilder } from "./builders";
import { Chars } from "./chars";
import { getDirectionBetween } from "./helpers";
import { Colors } from "./ui";
import * as Entities from "./entities";
import * as Tiles from "./tiles";
import * as Levels from "./levels";
import * as Substances from "./substances";

export let RollingBoulder = new RoomBuilder("rolling-boulder", `
,,,
.O.
.@.
.@.
.@.
.L.
`, {
  levelTypes: [Levels.PrimordialCaverns],
  rarity: Rarity.Uncommon,
  legend: {
    "O": {
      spawn: () => new Entities.Boulder,
      tile: Tiles.Floor,
    },
    ",": {
      constraint: tile => tile.type.walkable,
    },
    "@": {
      tile: Tiles.Floor,
    },
    "L": {
      tile: Tiles.Floor,
      constraint: tile => tile.type.walkable,
      spawn: () => new Entities.Lever(),
    },
  },
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
*%%%*
#...#
#...#
##=##
**-**
`, {
  legend: {
    "=": {
      tile: Tiles.IronBars,
      constraint: tile => tile.type.walkable,
    },
    "#": {
      tile: Tiles.Wall,
    },
    "%": {
      tile: Tiles.Wall,
      constraint: tile => tile.type === Tiles.Wall,
    },
    ".": {
      tile: Tiles.Floor,
    },
    "-": {
      tile: Tiles.Floor,
      constraint: tile => tile.type.walkable,
    },
  },
});

export let MountedBallista = new RoomBuilder("mounted-ballista", `
...
.B.
...
`, {
  rarity: Rarity.Rare,
  legend: {
    ".": {
      constraint: tile => tile.type.walkable,
    },
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
  legend: {
    "#": {
      tile: Tiles.Wall,
    },
    "$": {
      tile: Tiles.Floor,
      spawn: () => new Entities.Chest(),
    },
  },
});

export let SnakePit = new RoomBuilder("snake-pit", `
.........
.#%%.%#..
#%%s%%%#.
#%%%$%s%.
.#%s%%%#.
.#%%.%#s.
..#......
`, {
  levelTypes: [Levels.PrimordialCaverns],
  rarity: Rarity.Uncommon,
  legend: {
    "$": {
      tile: Tiles.Floor,
      spawn: () => new Entities.Chest(),
    },
    "#": {
      tile: Tiles.Wall,
      constraint: tile => tile.type === Tiles.Wall,
    },
    "%": {
      tile: Tiles.Floor,
      substance: () => new Substances.Slime(Infinity),
    },
    "s": {
      tile: Tiles.Floor,
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
  levelTypes: [Levels.PrimordialCaverns],
  rarity: Rarity.Common,
  legend: {
    ".": {
      constraint: tile => tile.type.walkable,
    },
    "#": {
      tile: Tiles.Wall,
    }
  }
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
  legend: {
    "+": {
      constraint: tile => tile.type.walkable,
    },
    "#": {
      tile: Tiles.Wall,
    },
    "%": {
      tile: Tiles.Wall,
      constraint: tile => !tile.type.walkable,
    },
    "$": {
      tile: Tiles.Floor,
      spawn: () => new Entities.Chest(),
    },
  },
});

