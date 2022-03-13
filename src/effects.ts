import { Circle, Point, Raster, RNG, Vector } from "silmarils";
import { Colors, Glyph } from "./common";
import { Damage, Effect, Entity } from "./game";

interface ExplosionParticle {
  vector: Vector.Vector;
  point: Point.Point;
  glyph: Glyph;
  age: number;
}

export function* Explosion({
  pos,
  size,
  attacker,
  getGlyph,
  getDamage,
  canTarget,
}: {
  pos: Point.Point,
  size: number,
  attacker: Entity | undefined,
  getGlyph: () => Glyph,
  getDamage: () => Damage,
  canTarget?: (entity: Entity) => boolean,
}): Effect {
  let center = Point.clone(pos);
  let radius = 0;
  let particles: ExplosionParticle[] = [];

  let done = game.level.addFX(terminal => {
    let circle = Circle.from(center.x, center.y, radius);

    for (let point of Raster.fillCircle(circle)) {
      let glyph = getGlyph();
      terminal.putGlyph(point.x, point.y, glyph);
    }

    for (let particle of particles) {
      if (particle.age < 0) continue;
      particle.age -= 1;
      Point.translate(particle.point, particle.vector);
      terminal.putGlyph(particle.point.x, particle.point.y, particle.glyph);
    }
  });

  for (let i = 0; i < 10; i++) {
    let angle = (i / 10) * (Math.PI * 2);
    // TODO: https://github.com/danprince/silmarils/issues/23
    let vector = Vector.fromAngle(angle, 0.5) as Vector.Vector;

    // Do we need to round?
    //vector[0] = Math.round(vector[0]);
    //vector[1] = Math.round(vector[1]);

    particles.push({
      point: Point.clone(center),
      vector: vector,
      glyph: Glyph(".", Colors.Grey3),
      age: RNG.int(0, 100),
    });
  }

  for (let i = 0; i <= size; i++) {
    radius = i;
    yield 3;
  }

  for (let entity of game.level.entities) {
    // Outside of the blast radius
    if (Point.distance(center, entity.pos) > size) continue;

    // Check whether the entity can be targeted
    if (canTarget && canTarget(entity) === false) continue;

    let damage = getDamage();

    if (attacker) {
      attacker.attack(entity, damage);
    } else {
      entity.applyDamage(damage);
    }
  }

  done();
}
