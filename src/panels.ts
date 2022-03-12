import { Array2D } from "silmarils";
import { Glyph, Chars, Colors } from "./common";
import { debuggingRenderer as designerDebuggingRenderer } from "./designer";
import { Ability, DamageType, Entity, Status, Tile } from "./game";
import { glyphToString } from "./helpers";
import { Panel, debugBigDigit, singleLineLength, Terminal } from "./terminal";

export class ViewportPanel extends Panel {
  dijkstraMapsEnabled = false;

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
          char = substance.char || char; 
          fg = substance.fg;
          bg = substance.bg;
        }

        terminal.put(x, y, char, fg, bg);
      }
    }

    let focusedEntity: Entity | undefined;

    for (let entity of game.level.entities) {
      let glyph = entity.getStatusGlyph();
      let intentGlyph = entity.getIntentGlyph();

      terminal.put(
        entity.pos.x,
        entity.pos.y,
        glyph.char,
        glyph.fg,
        glyph.bg || Colors.Black
      );

      if (intentGlyph) {
        terminal.putGlyph(
          entity.pos.x,
          entity.pos.y,
          intentGlyph,
        );
      }

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

    if (this.dijkstraMapsEnabled) {
      this.drawDijkstraMaps(terminal);
    }

    if (terminal.isKeyDown("Alt")) {
      this.drawShortestPath(terminal);
    }

    // Render anything that the level designer wants to debug
    designerDebuggingRenderer(terminal);
  }

  drawShortestPath(terminal: Terminal) {
    let pointer = terminal.getRelativePointerPosition();
    let path = game.level.findShortestPath(game.player.pos, pointer);

    for (let cell of path) {
      terminal.put(cell.x, cell.y, "+", Colors.Green);
    }

    terminal.print(pointer.x + 1, pointer.y, `${pointer.x}, ${pointer.y}`, Colors.White);
  }

  drawDijkstraMaps(terminal: Terminal) {
    let map = game.level.getDijkstraMap(game.player.pos);
    console.log(Array2D.toString(Array2D.map(map.costSoFar, (cost) => isFinite(cost) ? String(cost % 10) : "∞")));

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let cost = Array2D.get(map.costSoFar, x, y)!;
        debugBigDigit(terminal, x, y, cost);
      }
    }
  }

  drawEntityPopup(terminal: Terminal, entity: Entity) {
    let text = "";

    if (entity.hp) {
      text += `{31}${Chars.Heart}{1}${entity.hp.current}{/} `;
    }

    text += entity.name;

    if (entity.statuses.length) {
      text += " ";
    }

    for (let status of entity.statuses) {
      text += glyphToString(status.glyph);
    }

    terminal.drawPopup({
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
            defer = () => terminal.drawPopup({
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
            defer = () => terminal.drawPopup({
              x: px + 2,
              y: py,
              title: part.name,
              text: part.description,
            });
          }
          tx += 1;
        } else if (typeof part === "string" || typeof part === "number") {
          let text = part.toString();
          terminal.write(tx, ty, text, { fg: color });
          tx += singleLineLength(text);
        } else {
          terminal.putGlyph(tx, ty, part);
          tx += 1;
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
        terminal.drawPopup({
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
  renderPopup = () => {};
  _x = 0;

  renderPanel(terminal: Terminal): void {
    let { hp, ability, statuses, currency } = game.player;

    this.renderPopup = () => {};

    this._x = 0;

    this.renderIcon(
      terminal,
      Glyph(Chars.Heart, Colors.Red),
      String(hp.current),
      (x, y) => terminal.drawPopup({
        x,
        y,
        title: "Hitpoints",
        text: "If these run out, the game is over.",
      }),
    );

    this.renderIcon(
      terminal,
      Glyph(Chars.Obsidian, Colors.Grey2),
      String(currency),
      (x, y) => terminal.drawPopup({
        x,
        y,
        title: "Obsidian",
        text: "The shards seem valuable",
      }),
    );

    for (let status of statuses) {
      this.renderIcon(
        terminal,
        status.glyph,
        isFinite(status.turns) ? String(status.turns) : "",
        (x, y) => terminal.drawPopup({
          x,
          y,
          title: status.name,
          text: status.description,
        }),
      );
    }

    if (game.player.hasKey) {
      this.renderKey(terminal);
    }

    if (ability) {
      this.renderAbility(terminal, ability);
    }

    this.renderPopup();
  }

  renderIcon(
    terminal: Terminal,
    glyph: Glyph,
    label: string,
    popup: (x: number, y: number) => void
  ) {
    let x = this._x;
    terminal.putGlyph(x, 0, glyph);
    terminal.print(x + 1, 0, label, Colors.White);
    this._x = 1 + label.length + 1;

    if (terminal.isPointerOver(x, 0, 1 + label.length, 1)) {
      this.renderPopup = () => popup(x, 2);
    }
  }

  renderKey(terminal: Terminal) {
    let x = terminal.width - 3;
    terminal.put(x, 0, Chars.Key, Colors.Orange);
  }

  renderAbility(terminal: Terminal, ability: Ability) {
    let usable = ability.canUse();
    let fg = usable ? ability.glyph.fg : Colors.Grey2;
    let bg = usable ? ability.glyph.bg : Colors.Grey1;

    let x1 = terminal.width - 1;
    terminal.put(x1, 0, ability.glyph.char, fg, bg);

    if (terminal.isPointerOver(x1, 0)) {
      terminal.drawPopup({
        x: x1,
        y: 2,
        align: "start",
        justify: "end",
        title: ability.name,
        text: ability.description,
      });
    }
  }
}
