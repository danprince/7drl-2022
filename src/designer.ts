import { Array2D, Direction, Point, PRNG } from "silmarils";
import { Digger, Marker } from "./digger";
import { Level, LevelType, Entity, Tile, Substance, Stat, Status } from "./game";
import { assert, DijkstraMap, directionToGridVector, maxBy, minBy } from "./helpers";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Statuses from "./statuses";

import { debugBigDigit, debugDot, debugDigit, debugPercent, Terminal } from "./terminal";

export let debuggingRenderer = (terminal: Terminal) => {};

const DEFAULT_LEVEL_WIDTH = 21;
const DEFAULT_LEVEL_HEIGHT = 21;
const DESIGNERS_PER_LEVEL = 10;
const MAX_DIG_ATTEMPTS = 10;
const UNCOMMON_CHANCE = 0.15;
const RARE_CHANCE = 0.05;

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

interface Regions {
  index: Array2D.Array2D<number>;
  groups: Point.Point[][];
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
  /**
   * How big is the region that this point is part of.
   */
  regionSize: number;
  /**
   * How surrounded this cell is by walls.
   */
  adjacentWalls: number;
  cellsInLineOfSight: number;
}

interface CellPotentials {
  shortcut: number;
  reward: number;
  monsterSpawn: number;
  uncommonMonster: number;
  rareMonster: number;
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
  regions: Regions;
  criticalPath: Point.Point[];
  cellMetrics: Array2D.Array2D<CellMetrics>;
  cellPotentials: Array2D.Array2D<CellPotentials>;
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

    this.regions = this.computeRegions();
    this.cellMetrics = this.computeCellMetrics();
    this.cellPotentials = this.computeCellPotentials();
    this.addRewards();
    this.addMonsters();
    this.addEnvironment();
    this.addTraps();
    this.addDecorations();
  }

  setEntity(entity: Entity, point: Point.Point) {
    this.finalise(point);
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

  accessiblePoints() {
    return this.points().filter(point => isFinite(this.entranceMap.distanceTo(point)));
  }

  walkablePoints() {
    return this.points().filter(point => this.isWalkable(point));
  }

  score(): number {
    return this.criticalPath.length;
  }

  calculateRewardPotential(point: Point.Point): number {
    let metrics = this.getMetricsForPoint(point);

    // Ignore points that can't be accessed from the critical path
    if (metrics.distanceFromEntrance === Infinity) return 0;

    let chance = 0;

    // Greater chance for rewards the further you get from the critical path
    chance += Math.min(metrics.distanceFromCriticalPath, 100) / 100;

    // Greater chance still if it isn't on route to the exit
    chance += Math.min(metrics.distanceFromExit, 100) / 200;

    // More likely to spawn rewards in cells that are surrounded
    chance *= metrics.adjacentWalls;

    return chance;
  }

  addRewards() {
    let rewards: Entity[] = [];

    let pointsByRewardPotential = this.points()
      .filter(point => this.isWalkable(point))
      .filter(point => !this.isFinalised(point))
      .sort((a, b) => (
        this.getPotentialsForPoint(a).reward -
        this.getPotentialsForPoint(b).reward
      ));

    // Take the highest reward potential and place the key chest there
    let rewardPoint = pointsByRewardPotential.pop()!;
    let keyChest = new Entities.Chest();
    keyChest.pos = rewardPoint;
    keyChest.loot = () => game.player.addStatus(new Statuses.FoundKey);
    rewards.push(keyChest);

    let maxRewards = this.levelType.characteristics.maxRewards;
    let totalRewards = PRNG.int(this.rng, 0, maxRewards) + 1;

    while (
      rewards.length < totalRewards &&
      pointsByRewardPotential.length > 0
    ) {
      let nextRewardPoint = pointsByRewardPotential.pop()!;

      // Don't spawn rewards close to other rewards
      let distancesToRewards = rewards.map(reward =>
        Point.distance(nextRewardPoint, reward.pos));
      let distanceToNearestReward = Math.min(...distancesToRewards);
      if (distanceToNearestReward < 10) continue;

      let reward = this.generateReward();
      reward.pos = nextRewardPoint;
      rewards.push(reward);
    }

    for (let reward of rewards) {
      this.setEntity(reward, reward.pos);
    }
  }

  generateReward() {
    let chest = new Entities.Chest();
    let rare = PRNG.chance(this.rng, RARE_CHANCE);
    let uncommon = PRNG.chance(this.rng, UNCOMMON_CHANCE);
    let currency = 0;

    if (rare) currency = PRNG.int(this.rng, 10, 20);
    else if (uncommon) currency = PRNG.int(this.rng, 2, 5);
    else currency = 1;

    chest.loot = (entity: Entity) => {
      if (entity === game.player) {
        game.player.addCurrency(currency);
      }
    };

    return chest;
  }

  addMonsters() {
    for (let point of this.accessiblePoints()) {
      let potentials = this.getPotentialsForPoint(point);
      let spawn = PRNG.chance(this.rng, potentials.monsterSpawn);
      if (spawn === false) continue;
      let spawnRare = PRNG.chance(this.rng, potentials.rareMonster);
      let spawnUncommon = PRNG.chance(this.rng, potentials.uncommonMonster);

      let entityTypes =
        spawnRare ? this.levelType.characteristics.rareMonsterTypes :
        spawnUncommon ? this.levelType.characteristics.uncommonMonsterTypes :
        this.levelType.characteristics.commonMonsterTypes;

      let entityType = PRNG.element(this.rng, entityTypes);
      let entity = new entityType();
      this.setEntity(entity, point);
    }
  }

  addEnvironment() {
    // TODO: Add pools and rivers
  }

  addDecorations() {

  }

  addTraps() {
    // TODO: Figure out how "commanding" a cell is, so that we know if it
    // sense to put a boulder/ballista there.
  }

  getAdjacentRegionIds(point: Point.Point): number[] {
    let neighbours = Point.mooreNeighbours(point);
    let regionIds = neighbours
      .map(neighbour => this.getRegionId(neighbour))
      .filter(regionId => regionId != null);
    let uniqueIds = new Set(regionIds);
    return Array.from(uniqueIds) as number[];
  }

  private debug() {
    enum Debug {
      Nothing,
      DistanceFromEntrance,
      DistanceFromExit,
      DistanceFromCriticalPath,
      CriticalPath,
      AdjacentWalls,
      CellsInLineOfSight,
      Regions,
      MonsterSpawnPotential,
      RareMonsterPotential,
      UncommonMonsterPotential,
    }

    debuggingRenderer = terminal => {
      for (let point of Array2D.iter(this.tiles)) {
        let metrics = this.getMetricsForPoint(point);
        let potentials = this.getPotentialsForPoint(point);

        switch (Debug.Nothing as Debug) {
          case Debug.DistanceFromEntrance:
            debugBigDigit(terminal, point.x, point.y, metrics.distanceFromEntrance);
            break;
          case Debug.DistanceFromEntrance:
            debugBigDigit(terminal, point.x, point.y, metrics.distanceFromEntrance);
            break;
          case Debug.DistanceFromCriticalPath:
            debugBigDigit(terminal, point.x, point.y, metrics.distanceFromCriticalPath);
            break;
          case Debug.CriticalPath:
            debugDot(terminal, point.x, point.y, metrics.distanceFromCriticalPath === 0 ? 1 : 0);
            break;
          case Debug.AdjacentWalls:
            debugDigit(terminal, point.x, point.y, metrics.adjacentWalls);
            break;
          case Debug.CellsInLineOfSight:
            debugBigDigit(terminal, point.x, point.y, metrics.cellsInLineOfSight);
            break;
          case Debug.Regions:
            debugDigit(terminal, point.x, point.y, this.getRegionId(point)!);
            break;
          case Debug.MonsterSpawnPotential:
            debugPercent(terminal, point.x, point.y, potentials.monsterSpawn);
            break;
          case Debug.RareMonsterPotential:
            debugPercent(terminal, point.x, point.y, potentials.rareMonster);
            break;
          case Debug.UncommonMonsterPotential:
            debugPercent(terminal, point.x, point.y, potentials.uncommonMonster);
            break;
        }
      }
    };
  }

  build(): Level {
    this.debug();

    let level = new Level(this.levelType, this.width, this.height);
    level.entrance = this.entrance;
    level.exit = this.exit;

    // Copy tiles and entities across
    for (let point of this.points()) {
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

    // Create entrance/exit tiles
    let entranceTile = new Tile(Tiles.Downstairs);
    let exitTile = new Tile(Tiles.Upstairs);

    entranceTile.onEnter = entity => {
      game.log("No going back");
    };

    exitTile.onEnter = entity => {
      if (entity === game.player) {
        let nextLevel = designLevel(this.levelType, this.exit);
        game.player.removeStatusType(Statuses.FoundKey);
        game.setLevel(nextLevel);
      }
    };

    level.setTile(level.entrance.x, level.entrance.y, entranceTile);
    level.setTile(level.exit.x, level.exit.y, exitTile);

    return level;
  }

  getMetricsForPoint(point: Point.Point) {
    return Array2D.get(this.cellMetrics, point.x, point.y)!;
  }

  getPotentialsForPoint(point: Point.Point) {
    return Array2D.get(this.cellPotentials, point.x, point.y)!;
  }

  private isPointOnCriticalPath(point: Point.Point): boolean {
    return Array2D.get(this.criticalPathPoints, point.x, point.y)!;
  }

  private calculateDijkstraMap(start: Point.Point): DijkstraMap {
    return new DijkstraMap(
      this.width,
      this.height,
      start,
      (curr, next): number => {
        // TODO: Check whether there are blocking entities?
        let tile = this.getTile(next);
        if (tile == null) return Infinity;
        return tile.type.getMovementCost();
      }
    );
  }

  private center() {
    return Point.floored({
      x: this.width / 2,
      y: this.height / 2,
    });
  }

  private findExit(): Point.Point {
    // Find a point that is a notable distance away from the entrance
    let maxPossibleDistance = this.entranceMap.longestPathLength();

    // If possible, it's quite aesthetically pleasing to use a central exit tile
    // so we'll try when the path isn't direct.
    let centerPoint = this.center();
    let centerDistance = this.entranceMap.distanceTo(centerPoint);
    let centralExitChance = PRNG.chance(this.rng, 0.5);
    if (centralExitChance && isFinite(centerDistance) && centerDistance >= 10) {
      return centerPoint;
    }

    // Find all points that are at least 60% of the way through the level
    let possibleExitPoints = this.points().filter(point => {
      let distance = this.entranceMap.distanceTo(point);
      if (distance === Infinity) return false;
      let normalized = distance / maxPossibleDistance;
      return normalized >= 0.6 && normalized < 0.9;
    });

    // It shouldn't be possible for this to happen because we are using the
    // dijkstra map to find the accessible points.
    assert(possibleExitPoints.length > 0, "No possible exits were found!");

    // TODO: Prioritise exits that are at the end of corridors, especially
    // if there is a tile to the right of the exit (to match the stairs)

    return PRNG.element(this.rng, possibleExitPoints);
  }

  private digTiles() {
    // Attempt to dig terrains until we find one that is considered
    // acceptable (e.g. the level entrance is accessible).
    for (let i = 0; i < MAX_DIG_ATTEMPTS; i++) {
      let seed = LevelDesigner.getNextSeed();
      let digger = new Digger(this.width, this.height, seed);

      this.levelType.dig(digger, this.entrance);

      // Dig a circle around the entrance to improve the chances that it links
      // up with more of the terrain.
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
      regionSize: this.calculateRegionSize(point),
      adjacentWalls: this.countAdjacentWalls(point),
      cellsInLineOfSight: this.countCellsInLineOfSight(point),
    };
  }

  private countCellsInLineOfSight(point: Point.Point): number {
    let count = 0;

    for (let dir of Direction.CARDINAL_DIRECTIONS) {
      let pos = Point.clone(point);
      let vec = directionToGridVector(dir);
      while (this.isWalkable(pos)) {
        Point.translate(pos, vec);
        count += 1;
      }
    }

    return count;
  }

  private computeCellPotentials() {
    return Array2D.generate<CellPotentials>(
      this.width,
      this.height,
      point => this.calculatePotentialsForCell(point)
    );
  }

  private calculatePotentialsForCell(point: Point.Point): CellPotentials {
    return {
      reward: this.calculateRewardPotential(point),
      monsterSpawn: this.calculateMonsterSpawnPotential(point),
      rareMonster: this.calculateRareMonsterPotential(point),
      uncommonMonster: this.calculateUncommonMonsterPotential(point),
      shortcut: this.calculateShortcutPotential(point),
    };
  }

  private calculateMonsterSpawnPotential(point: Point.Point): number {
    let { baseMonsterSpawnChance } = this.levelType.characteristics;
    let score = baseMonsterSpawnChance;
    let metrics = this.getMetricsForPoint(point);

    // If the tile isn't walkable, we never want to spawn there
    if (!this.isWalkable(point)) return -999;

    // If the cell is already finalised, we never want to spawn there
    if (this.isFinalised(point)) return -999;

    // If we're close to the entrance, it's much less likely we'll spawn
    if (metrics.distanceFromEntrance < 5) score -= 0.05;

    // If we're close to the critical path, it's more likely we'll spawn an enemy
    if (metrics.distanceFromCriticalPath < 5) score += 0.02;

    return score;
  }

  private calculateUncommonMonsterPotential(point: Point.Point): number {
    let metrics = this.getMetricsForPoint(point);
    let score = UNCOMMON_CHANCE;
    if (metrics.distanceFromCriticalPath > 10) score += 0.2;
    return score;
  }

  private calculateRareMonsterPotential(point: Point.Point): number {
    let metrics = this.getMetricsForPoint(point);
    let score = RARE_CHANCE;
    if (metrics.distanceFromCriticalPath > 10) score += 0.2;
    if (metrics.distanceFromCriticalPath > 30) score += 0.2;
    return score;
  }

  isWalkable(point: Point.Point) {
    let tile = this.getTile(point);
    return tile ? tile.type.walkable : false;
  }

  isAccessible(point: Point.Point) {
    return this.entranceMap.distanceTo(point) !== Infinity;
  }

  private calculateRegionSize(point: Point.Point): number {
    let regionId = Array2D.get(this.regions.index, point.x, point.y);
    if (regionId == null) return 0;
    let group = this.regions.groups[regionId];
    return group.length;
  }

  private getRegionId(point: Point.Point): number | undefined {
    return Array2D.get(this.regions.index, point.x, point.y);
  }

  private getRegionSize(regionIndex: number): number {
    return this.regions.groups[regionIndex].length;
  }

  private calculateShortcutPotential(point: Point.Point): number {
    // If the point is already walkable then it has no shortcut potential
    if (this.isWalkable(point)) return 0;

    let neighbours = Point
      .vonNeumannNeighbours(point)
      .filter(neighbour => this.isWalkable(neighbour));

    // TODO: Rethink this logic to use it when (and only when) it would make
    // it significantly faster to get to the end.
    //let distancesToExit = neighbours
    //  .map(neighbour => this.exitMap.distanceTo(neighbour))
    //  .filter(isFinite);

    //let minDistance = Math.min(...distancesToExit);
    //let maxDistance = Math.max(...distancesToExit);
    //let score = maxDistance - minDistance;

    // If the point has neighbours from different regions, then that also
    // increases the shortcut potential, based on the size of the region.
    let neighbourRegionIds = neighbours
      .map(neighbour => this.getRegionId(neighbour))
      .filter(regionId => regionId !== undefined);

    let uniqueRegionIds = new Set(neighbourRegionIds);

    if (uniqueRegionIds.size <= 1) {
      // This tile is only connected to one region, it can't ever be a
      // shortcut.
      return 0;
    }

    let regionSizes = Array
      .from(uniqueRegionIds)
      .map(id => this.getRegionSize(id!))

    // Calculate the expansion to the largest region
    let combinedRegionSizes = regionSizes
      .sort((a, b) => b - a)
      .slice(1)
      .reduce((a, b) => a + b);

    let score = combinedRegionSizes;

    let adjacentWalls = this.countAdjacentWalls(point);

    // Give the score a boost if this tile is part of a wall (2 neighbours)
    // or at the end of a corridor/depression (7 neighbours)
    if (adjacentWalls === 2 || adjacentWalls === 7) {
      score += 5;
    }

    return score;
  }

  private countAdjacentWalls(point: Point.Point): number {
    return Point.mooreNeighbours(point)
      .filter(neighbour => !this.isWalkable(neighbour))
      .length;
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

  private computeRegions(): Regions {
    let visitedIndexes = new Set<number>();
    let regionIndex = Array2D.create<number>(this.width, this.height);
    let regionGroups: Point.Point[][] = [];
    let currentRegionPoints: Point.Point[] = [];
    let currentRegionId = 0;

    for (let point of this.points()) {
      let index = point.x + point.y * this.width;

      if (visitedIndexes.has(index)) {
        continue;
      }

      if (!this.isWalkable(point)) {
        continue;
      }

      // We're at a walkable point that we haven't visited so far, which means
      // this must be a new region. Floodfill until we've covered it all.

      let stack: Point.Point[] = [point];

      while (stack.length) {
        let next = stack.pop()!;
        currentRegionPoints.push(next);
        Array2D.set(regionIndex, next.x, next.y, currentRegionId);

        for (let neighbour of Point.vonNeumannNeighbours(next)) {
          let neighbourIndex = neighbour.x + neighbour.y * this.width;

          if (visitedIndexes.has(neighbourIndex)) {
            continue;
          }

          if (this.isWalkable(neighbour)) {
            visitedIndexes.add(neighbourIndex);
            stack.push(neighbour);
          }
        }
      }

      // We've run out of points to explore, which means we're at the end
      // of the region.

      regionGroups.push(currentRegionPoints);
      currentRegionPoints = [];
      currentRegionId += 1;
    }

    return {
      index: regionIndex,
      groups: regionGroups,
    };
  }
}
