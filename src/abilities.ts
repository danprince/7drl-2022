import { Direction, Point, Vector } from "silmarils";
import { Chars, Glyph } from "./common";
import { Ability, Damage, DamageType, Substance, TargetingMode } from "./game";
import { directionToGridVector } from "./helpers";
import { Colors } from "./common";
import { Explosion } from "./effects";

export class Chain extends Ability {
  name = "Chain";
  glyph = Glyph(Chars.ChainLinkHorizontal, Colors.Grey3);
  targeting = TargetingMode.Directional;
  description = "";

  getDirectionalChar(direction: Direction.Direction) {
    switch (direction) {
      case Direction.NORTH:
      case Direction.SOUTH:
        return Chars.ChainLinkVertical;
      case Direction.EAST:
      case Direction.WEST:
        return Chars.ChainLinkHorizontal;
      case Direction.SOUTH_EAST:
      case Direction.NORTH_WEST:
        return Chars.ChainLinkLeft;
      case Direction.SOUTH_WEST:
      case Direction.NORTH_EAST:
        return Chars.ChainLinkRight;
    }
  }

  use(direction: Direction.Direction) {
    game.level.addEffect(this.lash(direction));
    return true;
  }

  *lash(direction: Direction.Direction) {
    // Chain modifiers should be able to hook into this flow to "do" certain things.
    // - Probably makes sense to introduce a mini event system and have hooks for things
    //   like cast, move, strike, and recoil.
    // - Should modifiers also get some control over the rendering? E.g. blue tip for
    //   knockback, green tip for poison, grapple tip for grapple?
    // - Does it make sense for chain to have a fully separate system for upgrades?
    //   Or could they just be done with ability specific vestiges?

    let tip = Point.clone(this.owner.pos);
    let vec = directionToGridVector(direction);
    let inv = Vector.multiplied(vec, [-1, -1]);
    let substance: Substance | undefined;

    let done = game.level.addFX(terminal => {
      // Draw chain links from the owner to the tip of the chain
      let pos = Point.clone(this.owner.pos);
      let char = this.getDirectionalChar(direction);
      let alt = false;

      // TODO: Should get these points from a method then iterate them
      while (!Point.equals(pos, tip)) {
        Point.translate(pos, vec);
        alt = !alt;
        let fg = alt ? Colors.Grey3 : Colors.Grey2;
        let bg: number | undefined;
        if (substance) {
          fg = substance.fg;
          bg = substance.bg;
        }
        terminal.put(pos.x, pos.y, char, fg, bg);
      }
    });

    // Move the tip of the chain out until it hits something
    // TODO: Probably cleaner to have a method which gets each point in
    // the line, then we just iterate through that instead of managing vectors.
    // And we can reverse the same line.
    while (true) {
      Point.translate(tip, vec);
      let tile = game.level.getTile(tip.x, tip.y);
      if (tile == null) break;
      if (tile.substance) substance = tile.substance;
      if (tile.type.flyable === false) break;
      let entities = game.level.getEntitiesAt(tip.x, tip.y);

      if (entities.length) {
        for (let entity of entities) {
          this.owner.attack(entity, this.getBaseDamage());

          // If there is substance on the chain then apply it to this
          // enemy.
          if (substance) {
            substance.enter(entity);
          }
        }

        break;
      }
    }

    yield 2;

    // Create an explosion
    game.level.addEffect(Explosion({
      pos: Point.clone(tip),
      size: 1,
      canTarget: () => true,
      getGlyph: () => Glyph("*", Colors.Grey2),
      getDamage: () => ({ type: DamageType.Explosion, amount: 1 }),
      attacker: this.owner,
    }));

    // Move the tip of the chain back to the player
    while (true) {
      Point.translate(tip, inv);
      yield 1;
      if (Point.equals(tip, this.owner.pos)) {
        break;
      }
    }

    done();
  }

  getBaseDamage(): Damage {
    return {
      type: DamageType.Chain,
      amount: 1,
    };
  }
}
