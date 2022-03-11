import { DeathEvent, EventHandler, StatusAddedEvent, TakeDamageEvent } from "./events";
import { Colors } from "./ui";

export class MessageLogHandler extends EventHandler {
  onTakeDamage(event: TakeDamageEvent): void {
    let { entity, dealer, damage } = event;

    if (damage.amount === 0) {
      return;
    }

    let healed = damage.amount < 0;
    let color = healed ? Colors.Green : Colors.Red;
    let verb = healed ? "gains" : "loses";
    let amount = `{${color}}${Math.abs(damage.amount)}{/}`;

    if (dealer) {
      game.log(dealer, "hit", entity, "with", damage.type, "for", amount);
    } else {
      game.log(entity, verb, amount, "from", damage.type);
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