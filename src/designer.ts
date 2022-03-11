import { Array2D, Point, PRNG } from "silmarils";
import { Digger, Marker } from "./digger";
import { Level, LevelType, Entity, Tile } from "./game";
import { assert, DijkstraMap, maxBy } from "./helpers";

import { putDebugDigit } from "./terminal";
import { ViewportPanel } from "./panels";

const DEFAULT_LEVEL_WIDTH = 21;
const DEFAULT_LEVEL_HEIGHT = 21;
const DESIGNERS_PER_LEVEL = 10;
const MAX_DIG_ATTEMPTS = 100;

export function designLevel(levelType: LevelType, entrance: Point.Point): Level {
  console.time("design");
  let designers: LevelDesigner[] = [];

  for (let i = 0; i < DESIGNERS_PER_LEVEL; i++) {
    designers.push(new LevelDesigner(levelType, entrance))
  }

  // Pick the level that had the best score out of all the ones we tried
  let bestLevelDesigner = maxBy(designers, designer => designer.score());

  let level = bestLevelDesigner.build();
  console.timeEnd("design");
  return level;
}

/**
 * Cell metrics will be used to figure out where in the level to place
 * rewards, enemies, traps and decorative tiles.
 */
interface CellMetrics {
  /**
   * The number of steps to the entrance.
   */
  distanceFromEntrance: number;
  /**
   * The number of steps to the exit.
   */
  distanceFromExit: number;
  /**
   * The number of steps to the nearest point that is on the critical path.
   */
  distanceFromCriticalPath: number;
}

export class LevelDesigner {
  // Level generation works on a completely separate seed to the main
  // game, so that level generation isn't affected by the state of the
  // main RNG instance.
  private static rng = PRNG.generator(0x123);

  static setSeed(seed: number) {
    this.rng = PRNG.generator(seed);
  }

  private static getNextSeed() {
    return PRNG.int(this.rng);
  }

  width = DEFAULT_LEVEL_WIDTH;
  height = DEFAULT_LEVEL_HEIGHT;
  rng = PRNG.generator(PRNG.int(LevelDesigner.rng));
  levelType: LevelType;
  entrance: Point.Point;
  exit: Point.Point;
  entranceMap: DijkstraMap;
  exitMap: DijkstraMap;
  criticalPath: Point.Point[];
  cellMetrics: Array2D.Array2D<CellMetrics>;
  criticalPathPoints = Array2D.create<boolean>(this.width, this.height, false);
  finalisedPoints = Array2D.create<boolean>(this.width, this.height, false);

  tiles = Array2D.create<Tile>(this.width, this.height);
  entities = Array2D.create<Entity>(this.width, this.height);

  constructor(levelType: LevelType, entrance: Point.Point) {
    this.levelType = levelType;
    this.entrance = entrance;

    this.tiles = this.digTiles();
    this.entranceMap = this.calculateDijkstraMap(this.entrance);
    this.exit = this.findExit();
    this.exitMap = this.calculateDijkstraMap(this.exit);

    this.finalise(this.entrance);
    this.finalise(this.exit);

    this.criticalPath = this.entranceMap.shortestPath(this.exit);

    for (let point of this.criticalPath) {
      Array2D.set(this.criticalPathPoints, point.x, point.y, true);
      this.finalise(point);
    }

    this.cellMetrics = this.computeCellMetrics();
  }

  setEntity(entity: Entity, point: Point.Point) {
    return Array2D.set(this.entities, point.x, point.y, entity);
  }

  getEntity(point: Point.Point) {
    return Array2D.get(this.entities, point.x, point.y);
  }

  getTile(point: Point.Point) {
    return Array2D.get(this.tiles, point.x, point.y);
  }

  setTile(point: Point.Point, tile: Tile) {
    Array2D.set(this.tiles, point.x, point.y, tile);
  }

  finalise(point: Point.Point) {
    Array2D.set(this.finalisedPoints, point.x, point.y, true);
  }

  isFinalised(point: Point.Point): boolean {
    return Array2D.get(this.finalisedPoints, point.x, point.y)!;
  }

  points() {
    let points: Point.Point[] = [];

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        points.push({ x, y });
      }
    }

    return points;
  }

  score(): number {
    return this.criticalPath.length;
  }

  build(): Level {
    //this.entranceMap.debug();
    //this.exitMap.debug();

    ViewportPanel.addDebuggingRenderer(terminal => {
      for (let { x, y } of Array2D.iter(this.tiles)) {
        let metrics = this.getMetricsForPoint({ x, y });
        let dist = metrics.distanceFromCriticalPath;

        if (dist > 20) {
          //putDebugDigit(terminal, x, y, metrics.distanceFromCriticalPath)
        }
      }
    });

    let level = new Level(this.levelType, this.width, this.height);
    level.entrance = this.entrance;
    level.exit = this.exit;

    for (let point of Array2D.points(this.tiles)) {
      let tile = this.getTile(point);
      let entity = this.getEntity(point);

      if (tile) {
        level.setTile(point.x, point.y, tile);
      }

      if (entity) {
        entity.pos = Point.clone(point);
        level.addEntity(entity);
      }
    }

    let tile = new Tile(level.type.characteristics.defaultDoorTile);

    tile.onEnter = entity => {
      if (entity === game.player) {
        let nextLevel = designLevel(this.levelType, this.exit);
        game.setLevel(nextLevel);
      }
    };

    level.setTile(level.exit.x, level.exit.y, tile);

    return level;
  }

  getMetricsForPoint(point: Point.Point): CellMetrics {
    return Array2D.get(this.cellMetrics, point.x, point.y)!;
  }

  private isPointOnCriticalPath(point: Point.Point): boolean {
    return Array2D.get(this.criticalPathPoints, point.x, point.y)!;
  }

  private calculateDijkstraMap(start: Point.Point): DijkstraMap {
    return new DijkstraMap(
      this.width,
      this.height,
      start,
      (curr, next) => {
        // TODO: Check whether there are blocking entities?
        let tile = this.getTile(next);
        return tile?.type.walkable ? 1 : Infinity;
      }
    );
  }

  private findExit(): Point.Point {
    // Find a point that is a notable distance away from the entrance
    let maxPossibleDistance = this.entranceMap.longestPathLength();

    // Find all points that are at least 60% of the way through the level
    let possibleExitPoints = this.points().filter(point => {
      let distance = this.entranceMap.distanceTo(point);
      if (distance === Infinity) return false;
      let normalized = distance / maxPossibleDistance;
      return normalized > 0.6;
    });

    // It shouldn't be possible for this to happen because we are using the
    // dijkstra map to find the accessible points.
    assert(possibleExitPoints.length > 0, "No possible exits were found!");

    // Of the possible exit points, prioritize ones that are surrounded
    let surroundedExitPoints = possibleExitPoints.filter(point => {
      return Point.mooreNeighbours(point).filter(neighbour => {
        return this.getTile(neighbour)?.type.walkable;
      }).length <= 3;
    });

    if (surroundedExitPoints.length) {
      return PRNG.element(this.rng, surroundedExitPoints);
    } else {
      return PRNG.element(this.rng, possibleExitPoints);
    }
  }

  private digTiles() {
    // Attempt to dig terrains until we find one that is considered
    // acceptable (e.g. the level entrance is accessible).
    for (let i = 0; i < MAX_DIG_ATTEMPTS; i++) {
      let seed = LevelDesigner.getNextSeed();
      let digger = new Digger(this.width, this.height, seed);

      // The digger can technically override this circle, but it can help in
      // some cases.
      this.levelType.dig(digger, this.entrance);

      // Dig a circle around the entrance to improve the chances that it links
      // up with the rest of the terrain
      digger.circle(this.entrance.x, this.entrance.y, 2);

      // Check whether there are enough open points to start building
      if (this.isDiggerAcceptable(digger)) {
        return this.diggerToTiles(digger);
      }

      console.log("unacceptable!")
      digger.debug();
    }

    // If we ran out of attempts it probably means that the digger is creating
    // impossible maps (e.g. all walls, or only diagonals). In that case we'll
    // just generate a basic level instead.
    let seed = LevelDesigner.getNextSeed();
    let digger = new Digger(this.width, this.height, seed);
    digger.fill(Marker.Floor)
    return this.diggerToTiles(digger);
  }

  private isDiggerAcceptable(digger: Digger): boolean {
    // If the entrance isn't free then we can immediately bail out.
    let entranceMarker = digger.get(this.entrance.x, this.entrance.y);
    if (entranceMarker !== Marker.Floor) return false;

    // Then we floodfill to find all points that are accessible from the
    // entrance to ensure that there's enough playable space in the level.
    let accessiblePoints = digger.getAccessiblePoints(this.entrance);
    return accessiblePoints.length >= 20; // TODO: This should be done with a constraint
  }

  private diggerToTiles(digger: Digger): Array2D.Array2D<Tile> {
    return digger.build(marker => {
      return new Tile(
        marker === Marker.Floor
          ? this.levelType.characteristics.defaultFloorTile
          : this.levelType.characteristics.defaultWallTile
      );
    });
  }

  private computeCellMetrics() {
    return Array2D.generate<CellMetrics>(
      this.width,
      this.height,
      point => this.calculateMetricsForCell(point)
    );
  }

  private calculateMetricsForCell(point: Point.Point): CellMetrics {
    return {
      distanceFromEntrance: this.entranceMap.distanceTo(point),
      distanceFromExit: this.exitMap.distanceTo(point),
      distanceFromCriticalPath: this.calculateDistanceFromCriticalPath(point),
    };
  }

  private calculateDistanceFromCriticalPath(start: Point.Point): number {
    // The logic here is quite shaky because it won't return the distance
    // to the nearest point on the critical path. It'll return the distance
    // to the nearest common point on the critical path and the path from
    // the entrance to this point.
    //
    // TODO: Maybe it would be best to check for the entrance and the exit?

    let point = start;
    let distance = 0;

    while (!this.isPointOnCriticalPath(point)) {
      let maybePoint = Array2D.get(this.entranceMap.cameFrom, point.x, point.y);

      if (maybePoint == null) {
        // We arrived back at the entrance without crossing any points on
        // the critical path.
        return Infinity;
      }

      distance += 1;
      point = maybePoint;
    }

    point = start;

    while (!this.isPointOnCriticalPath(point)) {
      let maybePoint = Array2D.get(this.exitMap.cameFrom, point.x, point.y);

      if (maybePoint == null) {
        // We arrived back at the entrance without crossing any points on
        // the critical path.
        return Infinity;
      }

      distance += 1;
      point = maybePoint;
    }

    return distance;
  }
}
