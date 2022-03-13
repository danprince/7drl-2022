import { Point } from "silmarils";
import { Level, Player, GameMessage, Vestige, Effect } from "./engine";
import { EventHandler, GameEvent } from "./events";
import { MessageLogHandler } from "./handlers";
import { clamp } from "./helpers";

const PARALLEL_EFFECTS = true;

export class Game extends EventHandler {
  level: Level = null!;
  player: Player = null!;
  messages: GameMessage[] = [];
  turns: number = 0;
  floor: number = 0;
  vestigePool: Vestige[] = [];
  globalEventHandlers: EventHandler[] = [
    new MessageLogHandler()
  ];

  addVestigeToPool(vestige: Vestige) {
    this.vestigePool.push(vestige);
  }

  removeVestigeFromPool(vestige: Vestige) {
    this.vestigePool.splice(this.vestigePool.indexOf(vestige), 1);
  }

  onEvent(event: GameEvent): void {
    if (this.level) {
      event.sendTo(this.level);
    }

    for (let handler of this.globalEventHandlers) {
      event.sendTo(handler);
    }
  }

  setLevel(level: Level) {
    this.floor += 1;
    this.level = level;
    this.level.autotile();
    this.player.pos = Point.clone(level.entrancePoint);
    this.level.addEntity(this.player);
    this.level.enter();
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  log(...message: GameMessage) {
    this.messages.push(message);
  }

  async* update(): AsyncGenerator<number, void> {
    this.updateTiles();
    yield* this.updateEntities();
    // If the player is no longer acting then we need to put frames
    // in between turns to stay responsive.
    yield this.player.dead ? 1 : 0;
    this.turns += 1;
  }

  updateTiles() {
    for (let tile of this.level.tiles) {
      tile?.update();
    }
  }

  async* updateEntities() {
    // Only update the entities that existed at the start of this turn
    let entities = [...this.level.entities];

    for (let entity of entities) {
      if (entity.dead) continue;

      if (entity === game.player) {
        yield 0;
      }

      while (true) {
        let result = await entity.update();

        if (entity === game.player && result === false) {
          yield 0;
        } else {
          break
        }
      }

      yield* this.updateEffects();
    }
  }

  *updateEffects() {
    if (PARALLEL_EFFECTS) {
      yield* this.updateEffectsParallel();
    } else {
      while (this.level.effects.length) {
        let effects = this.level.effects;
        this.level.effects = [];

        for (let effect of effects) {
          for (let frame of effect) {
            yield frame;
          }
        }
      }
    }
  }

  *updateEffectsParallel() {
    let timers = new WeakMap<Effect, number>();

    while (this.level.effects.length) {
      let effects = this.level.effects;
      this.level.effects = [];
      let timeStep = Infinity;

      for (let effect of effects) {
        // The effect won't have a timer if it was just added to the queue,
        // in which case we just use 0 as the default to ensure it will get
        // updated during the upcoming frame.
        let timer = timers.get(effect) ?? 0;

        timer -= 1;

        if (timer <= 0) {
          // If the timer hits zero, then the current step of this effect
          // has finished, so we should start processing the next step.
          let result = effect.next();
          // At this point we can check whether the effect is done and bail
          // out if it is (this makes sure it isn't added back onto the queue).
          if (result.done) continue;
          // Prevent effects from using fractional/negative/infinite timers.
          timer = Math.floor(clamp(0, result.value, 100));
        }

        // Find the minimum
        if (timer < timeStep) {
          timeStep = timer;
        }

        timers.set(effect, timer);
        this.level.effects.push(effect);
      }

      // If the timestep is still infinite, than means that 
      if (isFinite(timeStep)) {
        yield timeStep;
      }
    }
  }
}
