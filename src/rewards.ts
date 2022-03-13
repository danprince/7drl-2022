import { RNG } from "silmarils";
import { Colors, Chars, Glyph, Glyphs } from "./common";
import { designLevel } from "./designer";
import { DamageType, Rarity, Vestige } from "./engine";
import { Terminal, TextAlign, fmt } from "./terminal";
import { View } from "./ui";
import * as Levels from "./levels";


interface Reward {
  price: number;
  name: string;
  description: string;
  glyph: Glyph;
  onPurchase(): void;
}

class VestigeReward implements Reward {
  name: string;
  glyph: Glyph;
  description: string;
  price: number;

  constructor(private vestige: Vestige) {
    this.name = vestige.name;
    this.description = vestige.description;
    this.glyph = vestige.glyph;
    this.price = this.priceFromRarity(vestige.rarity);
  }

  private priceFromRarity(rarity: Rarity) {
    switch (rarity) {
      case Rarity.Rare: return RNG.int(20, 50);
      case Rarity.Uncommon: return RNG.int(10, 20);
      case Rarity.Common: return RNG.int(5, 10);
    }
  }

  onPurchase(): void {
    game.player.addVestige(this.vestige);
  }
}

class HealthReward implements Reward {
  name = "Replenish";
  glyph = Glyphs.HP;
  description = "Regain lost health";
  price: number;

  constructor(private amount: number) {
    this.price = RNG.int(amount * 1, amount * 3);
  }

  onPurchase(): void {
    game.player.applyDamage({
      type: DamageType.Healing,
      amount: -this.amount,
    });
  }
}

class PotionReward implements Reward {
  name = "Cleanse";
  glyph = Glyph(Chars.Potion, Colors.Turquoise);
  description = "Remove all status effects";
  price = RNG.int(0, 5);

  onPurchase(): void {
    for (let status of game.player.statuses) {
      game.player.removeStatus(status);
    }
  }
}

class MoneyReward implements Reward {
  glyph = Glyphs.Obsidian;
  description = "";
  price = 0;
  get name(): string {
    return `${this.amount}`;
  }

  constructor(private amount: number) {}

  onPurchase(): void {
    game.player.currency += this.amount;
  }
}

function rollVestigeReward(rarity: Rarity): VestigeReward | undefined {
  let rareVestiges =
    game.vestigePool.filter(vestige => vestige.rarity === Rarity.Rare);
  let uncommonVestiges =
    game.vestigePool.filter(vestige => vestige.rarity === Rarity.Uncommon);
  let commonVestiges =
    game.vestigePool.filter(vestige => vestige.rarity === Rarity.Uncommon);

  // Translate rare rolls into uncommon if the rare pool is empty.
  if (rarity === Rarity.Rare && rareVestiges.length === 0) rarity = Rarity.Uncommon;
  if (rarity === Rarity.Uncommon && uncommonVestiges.length === 0) rarity = Rarity.Common;

  let vestigeRewardPool =
    rarity === Rarity.Rare ? rareVestiges :
    rarity === Rarity.Uncommon ? uncommonVestiges :
    commonVestiges;

  let vestige = RNG.element(vestigeRewardPool);

  if (vestige) {
    game.removeVestigeFromPool(vestige);
    return new VestigeReward(vestige);
  }

  return undefined;
}

function rollNextReward(): Reward {
  let rolledForVestige = RNG.chance(0.5);
  let rolledRare = RNG.chance(0.05);
  let rolledUncommon = RNG.chance(0.15);

  if (rolledForVestige) {
    let rarity =
      rolledRare ? Rarity.Rare :
      rolledUncommon ? Rarity.Uncommon :
      Rarity.Common;

    let reward = rollVestigeReward(rarity);

    // Return here if we were able to pick a vestige. Sometimes that
    // won't be possible (for example the pool is completely)
    if (reward) return reward;
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

    return new HealthReward(amount);
  }

  // If we currently have status effects, we can roll a potion
  if (canRollPotion && RNG.chance(0.5)) {
    return new PotionReward();
  }

  // Otherwise, fall back to just rolling money
  let amount =
    rolledRare ? RNG.int(1, 30) : 
    rolledUncommon ? RNG.int(1, 20) : 
    RNG.int(1, 5);

  return new MoneyReward(amount);
}

export class RewardsView extends View {
  rewards: Reward[] = [];

  constructor() {
    super();
    // The first reward is always guaranteed
    this.rewards.push(rollNextReward());

    // Second reward is available if you found the key
    if (game.player.hasKey) {
      this.rewards.push(rollNextReward());
      game.player.hasKey = false;
      game.log("The key vanishes")
    }

    // Final reward if you killed everything in the previous level
    if (game.level.hasKilledAllMonsters()) {
      this.rewards.push(rollNextReward());
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
      dialog.put(-1, y, Chars.ChainLinkVertical, fg, Colors.Black);
      dialog.put(dialog.width, y, Chars.ChainLinkVertical, fg, Colors.Black);
    }

    let rewardListPanel = dialog.childWithPadding(1);
    this.renderRewardsList(rewardListPanel);

    let clickedContinue = dialog.button(4, dialog.height, "Continue");
    if (clickedContinue) this.continue();
  }

  continue() {
    let entrancePoint = game.level.exitPoint;
    let levelType = Levels.Caverns;

    if (game.floor >= 3) {
      // TODO: More levels
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
    let nameColor = Colors.White;
    let glyphFg = rewardFg;
    let glyphBg = rewardBg;
    let canAfford = reward.price <= game.player.currency;
    let hover = terminal.isPointerOver(-1, -1, terminal.width + 2, terminal.height + 2);
    let active = hover && terminal.isPointerDown();

    let frameColor =
      canAfford ? hover ? Colors.Grey3 : Colors.Grey2 :
      hover ? Colors.Red2 : Colors.Red1;

    terminal.frame(frameColor);

    if (hover) {
      this.selectedRewardIndex = this.rewards.indexOf(reward);
    }

    let rewardName = fmt()
      .color(glyphFg, glyphBg)
      .text(reward.glyph.char)
      .text(" ")
      .color(nameColor)
      .text(reward.name)
      .toString();

    let buyText = fmt()
      .color(Colors.Grey2)
      .text(Chars.Obsidian)
      .color(canAfford ? Colors.Green : Colors.Red)
      .text(reward.price)
      .toString()

    terminal.write(terminal.width / 2, 0, rewardName, {
      textAlign: TextAlign.Center
    });

    if (reward.price > 0) {
      terminal.write(terminal.width / 2, 2, buyText, {
        textAlign: TextAlign.Center
      });
    }

    if (hover && reward.description) {
      this.ui.popup(terminal, {
        x: terminal.width / 2,
        y: 4,
        text: reward.description,
        justify: "center",
        frameColor: rewardFg,
      });
    }

    if (active && canAfford) {
      this.buyReward(reward);
    }
  }

  buyReward(reward: Reward) {
    if (game.player.currency < reward.price) return;
    game.player.currency -= reward.price;
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
