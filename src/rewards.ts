import { RNG } from "silmarils";
import { Colors, Chars, Glyph, Glyphs } from "./common";
import { designLevel } from "./designer";
import { DamageType, Vestige } from "./game";
import { Terminal, TextAlign, fmt } from "./terminal";
import { View } from "./ui";
import * as Levels from "./levels";

function rollNextReward(): Reward {
  let rolledForVestige = RNG.chance(0.5);
  let rolledRare = RNG.chance(0.05);
  let rolledUncommon = RNG.chance(0.15);

  if (rolledForVestige && game.vestigePool.length > 0) {
    // TODO: Give vestiges rarities
    RNG.shuffle(game.vestigePool);
    let vestige = game.vestigePool.pop()!;
    return new VestigeReward(vestige);
  }

  // Otherwise, we're going to get a standard reward
  let canRollHP = game.player.hp.current < game.player.hp.max;
  let canRollPotion = game.player.statuses.length > 0;

  // If we are currently missing HP, we can roll a health reward
  if (canRollHP && RNG.chance(0.5)) {
    let amount =
      rolledRare ? 3 :
      rolledUncommon ? 2 :
      1;

    return new HealthReward(amount, 3);
  }

  // If we currently have status effects, we can roll a potion
  if (canRollPotion && RNG.chance(0.5)) {
    return new PotionReward(1);
  }

  // Otherwise, fall back to just rolling money
  let money =
    rolledRare ? RNG.int(1, 30) : 
    rolledUncommon ? RNG.int(1, 20) : 
    RNG.int(1, 5);

  return new MoneyReward(money);
}

interface Reward {
  price: number;
  name: string;
  description: string;
  glyph: Glyph;
  locked: boolean;
  keyRequired?: boolean;
  onPurchase(): void;
}

class VestigeReward implements Reward {
  price: number;
  name: string;
  glyph: Glyph;
  description: string;
  locked = false;

  constructor(private vestige: Vestige) {
    this.price = vestige.price;
    this.name = vestige.name;
    this.description = vestige.description;
    this.glyph = vestige.glyph;
  }

  onPurchase(): void {
    game.player.addVestige(this.vestige);
  }
}

class HealthReward implements Reward {
  name = "Replenish";
  glyph = Glyphs.HP;
  description = "Regain lost health";
  locked = false;

  constructor(private amount: number, public price: number) {
  }

  onPurchase(): void {
    game.player.applyDamage({
      type: DamageType.Healing,
      amount: this.amount,
    });
  }
}

class PotionReward implements Reward {
  name = "Cleanse";
  glyph = Glyph(Chars.Potion, Colors.Turquoise);
  description = "Remove all status effects";
  locked = false;

  constructor(public price: number) {}

  onPurchase(): void {
    for (let status of game.player.statuses) {
      game.player.removeStatus(status);
    }
  }
}

class MoneyReward implements Reward {
  glyph = Glyphs.Obsidian;
  description = "";
  locked = false;
  price = 0;

  get name(): string {
    return `${this.amount}`;
  }

  constructor(private amount: number) {}

  onPurchase(): void {
    game.player.currency += this.amount;
  }
}

export class RewardsView extends View {
  rewards: Reward[] = [];

  constructor() {
    super();
    let one = rollNextReward();
    let two = rollNextReward();
    let three = rollNextReward();

    let killedAllMonsters = game.level.hasKilledAllMonsters();
    let foundGoldenKey = game.player.hasKey;

    if (!foundGoldenKey) {
      two.locked = true;
    }
    if (!killedAllMonsters) {
      three.locked = true;
    }

    this.rewards = [one, two, three];

    if (game.player.hasKey) {
      game.player.hasKey = false;
      game.log("The key vanishes")
    }
  }

  render(root: Terminal): void {
    let dialog = root.child(6, 5, 15, 15);

    dialog.frame(Colors.Grey2);

    dialog.write(dialog.width / 2, -1, "Vestiges", {
      textAlign: TextAlign.Center,
      fg: Colors.Grey3,
    });

    for (let y = 0; y < dialog.height; y++) {
      let even = y % 2 === 0;
      let fg = even ? Colors.Grey2 : Colors.Grey1;
      dialog.put(-1, y, "\xa1", fg, Colors.Black);
      dialog.put(dialog.width, y, "\xa1", fg, Colors.Black);
    }

    let rewardListPanel = dialog.childWithPadding(1);
    this.renderRewardsList(rewardListPanel);

    let clickedContinue = dialog.button(4, dialog.height, "Continue");
    if (clickedContinue) this.continue();
  }

  continue() {
    let entrancePoint = game.level.exitPoint;
    let levelType = Levels.Caverns;

    if (game.floor >= 10) {
      levelType = Levels.Grasslands;
    } else if (game.floor >= 6) {
      levelType = Levels.Mantle;
    } else if (game.floor >= 3) {
      levelType = Levels.Jungle;
    }

    let level = designLevel(levelType, entrancePoint);
    game.setLevel(level);
    this.ui.close(this);
  }

  selectedRewardIndex = 0;

  renderRewardsList(terminal: Terminal) {
    let y = 0;

    for (let reward of this.rewards) {
      let panel = terminal.child(0, y, terminal.width, 3);
      this.renderReward(panel, reward);
      y += panel.height + 2;
    }
  }

  renderReward(terminal: Terminal, reward: Reward) {
    let rewardFg = reward.glyph.fg;
    let rewardBg = reward.glyph.bg;
    let nameColor = reward.locked ? Colors.Grey3 : Colors.White;
    let glyphFg = reward.locked ? Colors.Grey3 : rewardFg;
    let glyphBg = reward.locked ? Colors.Black : rewardBg;
    let canAfford = reward.price <= game.player.currency;
    let hover = terminal.isPointerOver(-1, -1, terminal.width + 2, terminal.height + 2);
    let active = hover && terminal.isPointerDown();

    let frameColor =
      reward.locked ? hover ? Colors.Grey2 : Colors.Grey1 :
      canAfford ? hover ? Colors.Grey3 : Colors.Grey2 :
      hover ? Colors.Red2 : Colors.Red1;

    terminal.frame(frameColor);

    if (hover) {
      this.selectedRewardIndex = this.rewards.indexOf(reward);
    }

    if (active && canAfford && !reward.locked) {
      this.buyReward(reward);
    }

    let rewardName = fmt()
      .color(glyphFg, glyphBg)
      .text(reward.glyph.char)
      .text(" ")
      .color(nameColor)
      .text(reward.name)
      .toString();

    let buyText = reward.locked ? (
      fmt()
        .color(Colors.Grey1, Colors.Grey2)
        .text("LOCKED")
        .toString()
    ) : reward.price > 0 ? (
      fmt()
        .color(Colors.Grey2)
        .text(Chars.Obsidian)
        .color(canAfford ? Colors.Green : Colors.Red)
        .text(reward.price)
        .toString()
    ) : (
      ""
    );

    terminal.write(terminal.width / 2, 0, rewardName, {
      textAlign: TextAlign.Center
    });

    terminal.write(terminal.width / 2, 2, buyText, {
      textAlign: TextAlign.Center
    });

    if (hover && !reward.locked && reward.description) {
      this.ui.popup(terminal, {
        x: 2,
        y: terminal.width / 2 + 4,
        text: reward.description,
        justify: "center",
        maxWidth: terminal.width,
        frameColor: rewardFg,
      });
    }

  }

  buyReward(reward: Reward) {
    if (reward.keyRequired && !game.player.hasKey) return;
    if (game.player.currency < reward.price) return;

    game.player.currency -= reward.price;
    if (reward.keyRequired) game.player.hasKey = false;
    this.rewards.splice(this.rewards.indexOf(reward), 1);

    reward.onPurchase();

    if (this.rewards.length === 0) {
      this.continue();
    }
  }

  onKeyDown(event: KeyboardEvent): boolean | void {
    return true;
  }
}
