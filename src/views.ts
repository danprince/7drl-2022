import { Game } from "./game";
import { Terminal, VirtualTerminal } from "./terminal";
import { View, Colors } from "./ui";

export class GameView extends View {
  viewport = new VirtualTerminal(0, 0, 0, 0);

  constructor(private game: Game) {
    super();
  }

  render(terminal: Terminal) {
    this.viewport.bounds.width = this.game.level.width;
    this.viewport.bounds.height = this.game.level.height;
    this.viewport.attach(terminal);
    this.drawViewport();
  }

  drawViewport() {
    let { game, viewport } = this;

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let tile = game.level.getTile(x, y);
        if (tile) {
          viewport.putGlyph(x, y, tile.glyph);
        }
      }
    }

    for (let entity of game.level.entities) {
      viewport.put(entity.pos.x, entity.pos.y, entity.glyph.char, entity.glyph.fg, Colors.Black);
    }
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "G":
        this.ui.open(new GlyphPickerView());
        return true;
      default:
        return true;
    }
  }
}

export class GlyphPickerView extends View {
  activeColor = Colors.White;
  activeChar = "\x00"
  terminal = new VirtualTerminal(5, 5, 24, 24);

  render(root: Terminal) {
    this.terminal.attach(root);
    this.drawGlyphPalette(this.terminal.child(0, 0, 16, 16));
    this.drawColorPalette(this.terminal.child(18, 0, 4, 8));
    this.drawGlyphPreview(this.terminal.child(18, 10, 1, 1));
    this.drawTilePreview(this.terminal.child(18, 13, 3, 3));
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
      case "G":
        this.ui.close(this);
        return true;
      default:
        return false;
    }
  }

  drawGlyphPalette(terminal: Terminal) {
    let selectedChar = this.activeChar;

    terminal.frame(Colors.Grey2);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        let active  = terminal.isPointerOver(x, y);
        let index = x + y * 16;
        let char = String.fromCharCode(index);
        let fg = active ? Colors.White : Colors.Grey3;
        let bg = Colors.Black;
        terminal.put(x, y, char, fg, bg);

        if (active && terminal.isPointerDown()) {
          this.activeChar = char;
        } else if (active) {
          selectedChar = char;
        }
      }
    }

    let hex = selectedChar.charCodeAt(0).toString(16).padStart(2, "0");
    terminal.print(0, -1, hex, Colors.Grey4, 0);
  }

  drawColorPalette(terminal: Terminal) {
    let selectedColor = this.activeColor;

    terminal.frame(Colors.Grey2);

    for (let color = 0; color < 32; color++) {
      let x = color % terminal.width;
      let y = color / terminal.width | 0;
      let active = terminal.isPointerOver(x, y);

      if (active && terminal.isPointerDown()) {
        this.activeColor = color;
      } else if (active) {
        selectedColor = color;
      }

      let char = selectedColor === color ? "\x7f" : " ";
      terminal.put(x, y, " ", Colors.Black, color);
      terminal.put(x, y, char, Colors.White);
    }

    let colorIndex = selectedColor.toString().padStart(2, "0");
    terminal.print(0, -1, colorIndex, Colors.White, 0);
  }

  drawGlyphPreview(terminal: Terminal) {
    terminal.frame(Colors.Grey2);
    terminal.put(0, 0, this.activeChar, this.activeColor);
  }

  drawTilePreview(terminal: Terminal) {
    terminal.frame(Colors.Grey2);
    for (let i = 0; i < terminal.width; i++) {
      for (let j = 0; j < terminal.height; j++) {
        terminal.put(i, j, this.activeChar, this.activeColor);
      }
    }
  }
}
