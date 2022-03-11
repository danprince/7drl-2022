import { Entity, Speeds, Stat } from "./game";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export class PunchingBag extends Entity {
  name = "Punching Bag";
  description = "Has no chance!";
  glyph = Glyph("\x91", Colors.Orange4);
  hp = Stat(99);
  speed = Speeds.Never;
}
