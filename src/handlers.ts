import { DeathEvent, EventHandler, StatusAddedEvent, TakeDamageEvent } from "./events";
import { glyphToString } from "./helpers";
import * as Glyphs from "./glyphs";
import { Colors } from "./ui";

const HP = glyphToString(Glyphs.HP);

export class MessageLogHandler extends EventHandler {
  onTakeDamage(event: TakeDamageEvent): void {
    let { entity, dealer, damage } = event;
    let _amount = `${HP}{${Colors.Red}}${damage.amount}{/}`;

    if (dealer) {
      game.log(dealer, damage.type, "hit", entity, "for", _amount);
    } else {
      game.log(entity, "is", damage.type, "for", _amount);
    }
  }

  onDeath(event: DeathEvent): void {
    let { entity, killer } = event;

    if (killer) {
      game.log(killer, "kills", entity);
    } else {
      game.log(entity, "dies");
    }
  }

  onStatusAdded(event: StatusAddedEvent): void {
    let { entity, status } = event;

    if (isFinite(status.turns)) {
      game.log(entity, "is", status, `for ${status.turns} turns`);
    } else {
      game.log(entity, "is", status);
    }
  }
}