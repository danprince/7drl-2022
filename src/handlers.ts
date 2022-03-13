import { Glyph, Chars, Glyphs } from "./common";
import { DeathEvent, EnterLevelEvent, EventHandler, GainCurrencyEvent, StatusAddedEvent, TakeDamageEvent } from "./events";
import { Colors } from "./common";
import { fmt } from "./terminal";

export class MessageLogHandler extends EventHandler {
  onTakeDamage(event: TakeDamageEvent): void {
    let { entity, dealer, damage } = event;

    if (damage.amount === 0) {
      return;
    }

    let healed = damage.amount < 0;
    let color = healed ? Colors.Green : Colors.Red;
    let verb = healed ? "gains" : "takes";

    let amount = fmt()
      .glyph(Glyphs.HP)
      .color(color)
      .text(Math.abs(damage.amount))
      .toString();

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

  onGainCurrency(event: GainCurrencyEvent): void {
    game.log("You find", Glyph(Chars.Obsidian, Colors.Grey2), event.amount);
  }

  onEnterLevel(event: EnterLevelEvent): void {
    game.log(Chars.Upstairs, event.level.type.name, "-", game.floor);
  }
}