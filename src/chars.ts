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
  CaretUp: "\x0e",

  // Icons
  Droplet: "\x10",
  Stun: "\x11",
  Sword: "\x12",
  Magic: "\x13",
  Spade: "\x14",
  Fist: "\x15",
  Loop: "\x16",
  Skull: "\x17",
  Boots: "\x18",
  Fire: "\x19",
  Eye: "\x1a",
  Missile: "\x1b",
  Grapple: "\x1c",
  Time: "\x1d",
  Snowflake: "\x1e",

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
  Cultist: "\x8b",
  Demon: "\x8c",
  Golem: "\x8d",
  Wizard: "\x8e",
  Thwomp: "\x8f",
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
  Boulder: "\xaf",

  // Tiles
  Block1: "\xc0",
  Block2: "\xc1",
  Block3: "\xc2",
  Blocks: ["\xc0", "\xc1", "\xc2"],
  Ripples: "\xc3",
  Diagonals: createCharSet(0xc8, 2),
  Cobbles: createCharSet(0xc4, 4),
  BoneWalls: createCharSet(0xd0, 11),
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
