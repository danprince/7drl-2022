import { Circle, Point, Raster } from "silmarils";
import { Damage, Effect, Entity } from "./game";
import { Glyph } from "./terminal";

export function* Explosion({
  pos,
  size,
  attacker,
  glyph,
  getDamage,
  canTarget,
}: {
  pos: Point.Point,
  size: number,
  attacker: Entity | undefined,
  glyph: Glyph,
  getDamage: () => Damage,
  canTarget?: (entity: Entity) => boolean,
}): Effect {
  let radius = 0;

  let done = game.level.addFX(terminal => {
    let circle = Circle.from(pos.x, pos.y, radius);

    for (let point of Raster.fillCircle(circle)) {
      terminal.putGlyph(point.x, point.y, glyph);
    }
  });

  for (let i = 0; i <= size; i++) {
    radius = i;
    yield 1;
  }

  for (let entity of game.level.entities) {
    // Outside of the blast radius
    if (Point.distance(pos, entity.pos) > size) continue;

    // Check whether the entity can be targeted
    if (canTarget && canTarget(entity) === false) continue;

    let damage = getDamage();

    if (attacker) {
      attacker.attack(entity, damage);
    } else {
      entity.applyDamage(damage);
    }
  }

  yield 1;
  done();
}
