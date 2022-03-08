import { DeathEvent, EventHandler, StatusAddedEvent, TakeDamageEvent } from "./events";
import { Colors } from "./ui";

export class MessageLogHandler extends EventHandler {
  onTakeDamage(event: TakeDamageEvent): void {
    let { entity, dealer, damage } = event;
    let _amount = `{${Colors.Red}}${damage.amount}{/}`;

    if (dealer) {
      game.log(dealer, "hit", entity, "with", damage.type, "for", _amount);
    } else {
      game.log(entity, "loses", _amount, "to", damage.type);
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
      game.log(entity, "is now", status);
    }
  }
}