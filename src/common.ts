import { Direction } from "silmarils";

export const ENERGY_REQUIRED_PER_TURN = 12;

export interface Glyph {
  char: string;
  fg: number;
  bg?: number;
}

export function Glyph(char: string, fg: number, bg?: number): Glyph {
  return { char, fg, bg };
}

export const Colors = {
  // Base palette
  Black: 0,
  White: 1,
  Grey: 7,
  Orange: 11,
  Green: 15,
  Turquoise: 19,
  Blue: 23,
  Pink: 27,
  Red: 31,

  // Sets
  Greys: [4, 5, 6, 7],
  Oranges: [8, 9, 10, 11],
  Greens: [12, 13, 14, 15],
  Turquoises: [16, 17, 18, 19],
  Blues: [20, 21, 22, 23],
  Pinks: [24, 25, 26, 27],
  Reds: [28, 29, 30, 31],

  // Shades
  Grey1: 4,
  Grey2: 5,
  Grey3: 6,
  Grey4: 7,
  Orange1: 8,
  Orange2: 9,
  Orange3: 10,
  Orange4: 11,
  Green1: 12,
  Green2: 13,
  Green3: 14,
  Green4: 15,
  Turquoise1: 16,
  Turquoise2: 17,
  Turquoise3: 18,
  Turquoise4: 19,
  Blue1: 20,
  Blue2: 21,
  Blue3: 22,
  Blue4: 23,
  Pink1: 24,
  Pink2: 25,
  Pink3: 26,
  Pink4: 27,
  Red1: 28,
  Red2: 29,
  Red3: 30,
  Red4: 31,
};

export const Chars = {
  Null: "\x00",

  // Directions
  North: "\x01",
  NorthEast: "\x02",
  East: "\x03",
  SouthEast: "\x04",
  South: "\x05",
  SouthWest: "\x06",
  West: "\x07",
  NorthWest: "\x08",

  // Geometry
  Box: "\x09",
  Circle: "\x0a",
  CircleOutline: "\x0b",
  Heart: "\x0c",
  Diamond: "\x0d",
  Key: "\x0e",
  CaretUp: "\x0f",

  // Icons
  Droplet: "\x10",
  Stun: "\x11",
  Sword: "\x12",
  Magic: "\x13",
  Spade: "\x14",
  Fist: "\x15",
  Loop: "\x16",
  Skull: "\x17",
  Potion: "\x18",
  Fire: "\x19",
  Eye: "\x1a",
  Missile: "\x1b",
  Grapple: "\x1c",
  Time: "\x1d",
  Snowflake: "\x1e",
  Obsidian: "\x1f",
  ChainLinkHorizontal: "\xb0",
  ChainLinkVertical: "\xb1",
  ChainLinkRight: "\xb2",
  ChainLinkLeft: "\xb3",

  // Entities
  Creature: "\x80",
  Ant: "\x81",
  Lizard: "\x82",
  Worm: "\x83",
  Frog: "\x84",
  Snail: "\x85",
  Snake: "\x86",
  Imp: "\x87",
  Boar: "\x88",
  Knight: "\x89",
  Krokodil: "\x8a",
  KrokodilCrawling: "\x8b",
  Demon: "\x8c",
  Man: "\x8c",
  ManArmsUp: "\x8d",
  Wizard: "\x8e",
  Thwomp: "\x8f",
  Gnome: "\x90",
  GnomeKing: "\x91",
  Slime: "\x92",
  Skeleton: "\x93",
  Chicken: "\x94",
  Bat: "\x95",
  Monkey: "\xa4",
  Spider: "\xa5",
  Mimic: "\xa9",

  // Props
  Egg: "\x96",
  Portal1: "\x97",
  Portal2: "\x98",
  Portal3: "\x99",
  Portals: createCharSet(0x97, 3),
  Ribs: "\x9a",
  Bone: "\x9b",
  Mushroom1: "\x9c",
  Mushroom2: "\x9d",
  Mushrooms: ["\x9c", "\x9d"],
  Tree1: "\x9e",
  Tree2: "\x9f",
  Trees: ["\x9e", "\x9f"],
  LeverLeft: "\xad",
  LeverRight: "\xae",
  Chest: "\xaa",
  Boulder: "\xaf",
  WoodenStuff: createCharSet(0xa4, 7),

  // Tiles
  Liquid: createCharSet(0xb0, 16),
  Block1: "\xc0",
  Block2: "\xc1",
  Block3: "\xc2",
  Dot: "\xc4",
  Blocks: ["\xc0", "\xc1", "\xc2"],
  Ripples: "\xc3",
  Bars: "\xce",
  Doorway: "\xcf",
  Upstairs: "\xcd",
  Downstairs: "\xcc",
  Stalagmite: "\xdb",
  Diagonals: createCharSet(0xc8, 2),
  ThickDiagonals: createCharSet(0xca, 2),
  Cobbles: createCharSet(0xc4, 4),
  Walls: createCharSet(0xd0, 4),
  BoneWalls: createCharSet(0xd0, 11),
  JungleWalls: createCharSet(0xd0, 4).concat(createCharSet(0xdb, 4)),
  Flagstones: createCharSet(0xdb, 5),
  BoxDrawing: createCharSet(0xe0, 16),
  BrickWalls: createCharSet(0xf0, 16),
}

function createCharSet(startCharCode: number, size = 16) {
  let chars: string[] = [];
  for (let i = 0; i < size; i++) {
    chars.push(String.fromCharCode(startCharCode + i));
  }
  return chars;
}

export const Glyphs = {
  Poison: Glyph(Chars.Droplet, Colors.Green),
  Melee: Glyph(Chars.Fist, Colors.White),
  Stun: Glyph(Chars.Stun, Colors.Blue),
  Knockback: Glyph(Chars.East, Colors.Blue),
  HP: Glyph(Chars.Heart, Colors.Red),
  Obsidian: Glyph(Chars.Obsidian, Colors.Grey2),
  Turns: Glyph(Chars.Time, Colors.Blue),
  Molten: Glyph(Chars.Diamond, Colors.Orange),
  Chain: Glyph(Chars.ChainLinkHorizontal, Colors.Grey3),
};

export const DIRECTION_CHARS: {
  [K in Direction.Direction]: string
} = {
  [Direction.NORTH]: Chars.North,
  [Direction.SOUTH]: Chars.South,
  [Direction.WEST]: Chars.West,
  [Direction.EAST]: Chars.East,
  [Direction.NORTH_EAST]: Chars.NorthEast,
  [Direction.SOUTH_EAST]: Chars.SouthEast,
  [Direction.NORTH_WEST]: Chars.NorthWest,
  [Direction.SOUTH_WEST]: Chars.SouthWest,
};

export function getDirectionChar(direction: Direction.Direction): string {
  return DIRECTION_CHARS[direction];
}

export const Speeds = {
  Never: 0,
  EveryTurn: ENERGY_REQUIRED_PER_TURN,
  Every2Turns: ENERGY_REQUIRED_PER_TURN / 2,
  Every3Turns: ENERGY_REQUIRED_PER_TURN / 3,
  Every4Turns: ENERGY_REQUIRED_PER_TURN / 4,
  Every6Turns: ENERGY_REQUIRED_PER_TURN / 6,
};

export const StatusGlyphs = {
  Stunned: Glyph(Chars.Stun, Colors.Grey3),
  Alerted: Glyph("!", Colors.Red),
  Attacking: Glyph(Chars.Sword, Colors.Red),
  North: Glyph(Chars.North, Colors.Red),
  South: Glyph(Chars.South, Colors.Red),
  West: Glyph(Chars.West, Colors.Red),
  East: Glyph(Chars.East, Colors.Red),
  NorthEast: Glyph(Chars.NorthEast, Colors.Red),
  NorthWest: Glyph(Chars.NorthWest, Colors.Red),
  SouthEast: Glyph(Chars.SouthWest, Colors.Red),
  SouthWest: Glyph(Chars.SouthWest, Colors.Red),
};
