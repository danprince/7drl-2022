import { Chars } from "./chars";
import { DamageType, Entity, Status, Tile } from "./game";
import { glyphToString } from "./helpers";
import { Poisoned } from "./statuses";
import { Panel, singleLineLength, Terminal } from "./terminal";
import { Colors } from "./ui";

export class ViewportPanel extends Panel {
  put(terminal: Terminal, x: number, y: number, ch: string, fg: number, bg?: number) {
    terminal.put(
      x + this.bounds.x - terminal.bounds.x,
      y + this.bounds.y - terminal.bounds.y,
      ch,
      fg,
      bg,
    );
  }

  renderPanel(terminal: Terminal) {
    terminal.frame(Colors.Grey1);

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let tile = game.level.getTile(x, y);
        if (tile == null) continue;
        let substance = tile.substance;
        let { char, fg, bg } = tile.glyph;

        if (substance) {
          fg = substance.fg;
          bg = substance.bg;
        }

        terminal.put(x, y, char, fg, bg);
      }
    }

    let focusedEntity: Entity | undefined;

    for (let entity of game.level.entities) {
      let glyph = entity.statusGlyph || entity.glyph;
      terminal.put(entity.pos.x, entity.pos.y, glyph.char, glyph.fg, Colors.Black);

      if (terminal.isPointerOver(entity.pos.x, entity.pos.y)) {
        focusedEntity = entity;
      }
    }

    for (let fx of game.level.fx) {
      fx(terminal);
    }

    if (focusedEntity) {
      this.drawEntityPopup(terminal, focusedEntity);
    }
  }

  drawEntityPopup(terminal: Terminal, entity: Entity) {
    let text = "";

    if (entity.hp) {
      text += `{31}\x03{1}${entity.hp.current}{/} `;
    }

    text += entity.name;

    if (entity.statuses.length) {
      text += " ";
    }

    for (let status of entity.statuses) {
      text += glyphToString(status.glyph);
    }

    terminal.popup({
      x: Math.floor(terminal.width / 2),
      y: terminal.height,
      text,
      textColor: Colors.Grey4,
      align: "end",
      justify: "center",
    });
  }
}

export class MessagesPanel extends Panel {
  viewport: ViewportPanel;

  constructor(viewport: ViewportPanel, x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
    this.viewport = viewport;
  }

  renderPanel(terminal: Terminal): void {
    let ty = 0;
    let tx = 0;
    let defer = () => {};

    for (let i = game.messages.length - 1; i >=0; i--) {
      let message = game.messages[i];
      let current = i === game.messages.length - 1;
      let color = current ? Colors.White : Colors.Grey4;

      for (const part of message) {
        // Keep a copy of this location for popups
        const px = tx;
        const py = ty;

        if (part instanceof Entity) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            if (part.dead) {
              this.viewport.put(terminal, part.pos.x, part.pos.y, Chars.Skull, Colors.White);
            } else {
              this.viewport.put(terminal, part.pos.x, part.pos.y - 1, Chars.South, Colors.White);
            }
          }
          tx += 1;
        } else if (part instanceof Tile) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            this.viewport.put(terminal, part.pos.x, part.pos.y - 1, Chars.South, Colors.White);
          }
          tx += 1;
        } else if (part instanceof Status) {
          terminal.putGlyph(tx, ty, part.glyph);

          if (terminal.isPointerOver(tx, ty)) {
            defer = () => terminal.popup({
              x: px,
              y: py + 1,
              title: `${glyphToString(part.glyph)} ${part.name}`,
              text: part.description,
            });
          }

          tx += 1;
        } else if (part instanceof DamageType) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            defer = () => terminal.popup({
              x: px + 2,
              y: py,
              title: part.name,
              text: part.description,
            });
          }
          tx += 1;
        } else {
          let text = part.toString();
          terminal.write(tx, ty, text, color);
          tx += singleLineLength(text);
        }

        tx += 1;
      }

      ty += 1;
      tx = 0;
      if (ty >= terminal.height) {
        break;
      }
    }

    defer();
  }
}

export class SidebarPanel extends Panel {
  renderPanel(terminal: Terminal): void {
    for (let i = 0; i < game.player.vestiges.length; i++) {
      let vestige = game.player.vestiges[i];
      terminal.putGlyph(0, i, vestige.glyph);

      if (terminal.isPointerOver(0, i)) {
        terminal.popup({
          x: 2,
          y: i,
          title: vestige.name,
          text: vestige.description,
          textColor: Colors.Grey3,
        });
      }
    }
  }
}

export class TopBarPanel extends Panel {
  renderPanel(terminal: Terminal): void {
    let { hp, ability } = game.player;

    let color = game.player.hasStatus(Poisoned) ? Colors.Green : Colors.Red;
    terminal.put(0, 0, Chars.Heart, color);
    terminal.print(1, 0, hp.current.toString(), Colors.White);

    if (ability) {
      let usable = ability.canUse();
      let fg = usable ? ability.glyph.fg : Colors.Grey2;
      let bg = usable ? ability.glyph.bg : Colors.Grey1;

      let x1 = terminal.width - 1;
      let x0 = terminal.width - ability.name.length - 2;
      terminal.put(x1, 0, ability.glyph.char, fg, bg);
      terminal.print(x0, 0, ability.name, fg);

      if (terminal.isPointerOver(x1, 0)) {
        terminal.popup({
          x: x1,
          y: 1,
          align: "start",
          justify: "end",
          text: ability.description,
        });
      }
    }
  }
}
