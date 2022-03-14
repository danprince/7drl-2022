import { Point, Direction, RNG } from "silmarils";
import { Digger, Marker, Symmetry, Spades, CellularAutomataRules } from "./digger";

type TerrainDigger = (digger: Digger, entrance: Point.Point) => void;

export const ruinous: TerrainDigger = (digger, entrance) => {
  digger.fill(Marker.Wall);

  // The first set of diggers go through the level with 1x1 spades and symmetry to
  // create some credible looking structures.
  digger.tunnels({
    start: entrance,
    iterations: 20,
    spawnChance: 0.4,
    deathChance: 0.02,
    mutationChance: 0.5,
    turnChance: 0.6,
    symmetry: Symmetry.Both,
    spades: [Spades.OneByOne],
    initialDirections: Direction.CARDINAL_DIRECTIONS,
  });

  // Invert the symmetric tunnels to turn them into walls.
  digger.invert();

  // Erode those walls with a new generation of non-symmetrical diggers.
  digger.tunnels({
    start: entrance,
    iterations: 30,
    spawnChance: 0.4,
    deathChance: 0.01,
    mutationChance: 0.5,
    spades: [Spades.OneByOne, Spades.TwoByTwo, Spades.Cross],
    initialDirections: Direction.CARDINAL_DIRECTIONS,
  });

  digger.addPerimeterWall();
  digger.radialNoise(0.1);
  digger.cellularAutomata({ rules: CellularAutomataRules.Smoothing });
};

export const alien: TerrainDigger = (digger, entrance) => {
  let nums = [0, 1, 2, 3, 4, 6, 7, 8];
  let born = RNG.shuffled(nums).slice(RNG.int(0, 9)).sort();
  let survive = RNG.shuffled(nums).slice(RNG.int(0, 9)).sort();
  let rules = [born, survive] as CellularAutomataRules;
  let seed = RNG.int(0, 0x100);
  //rules = [[0,4,8],[0,1,2,3,4,7,8]]
  //rules = [[1,2,3],[1,7,8]]
  rules = [[0,1,2,3,4,6,7],[2,8]]
  console.log(seed)
  console.log(JSON.stringify([born, survive]))

  digger.addBitPattern(seed);
  digger.cellularAutomata({ rules });
  digger.cellularAutomata({ rules: CellularAutomataRules.Smoothing, iterations: 100 });
  digger.tunnels({
    start: entrance,
    iterations: 30,
    spawnChance: 0.4,
    mutationChance: 0.5,
    spades: [Spades.OneByOne],
    initialDirections: Direction.CARDINAL_DIRECTIONS,
  });
  digger.addPerimeterWall()
};

export const cavernous: TerrainDigger = (digger) => {
  digger.noise(0.5);
  digger.cellularAutomata({ rules: CellularAutomataRules.Caves });
  digger.addPerimeterWall();
};

export const chaoticCaverns: TerrainDigger = (digger) => {
  digger.noise(0.5);
  digger.cellularAutomata({ rules: CellularAutomataRules.ChaoticCaverns2 });
  //digger.cellularAutomata({ rules: CellularAutomataRules.Smoothing });
  digger.addPerimeterWall();
};

export const volcanic: TerrainDigger = (digger, entrance) => {
  // Generate some closed caves
  digger.noise(0.5);
  digger.cellularAutomata({ rules: CellularAutomataRules.Caves });

  // Simulate some big worms moving through the level
  digger.tunnels({
    start: entrance,
    iterations: 100,
    spawnChance: 0,
    turnChance: 0.3,
    spades: [Spades.TwoByTwo],
    initialDirections: Direction.INTERCARDINAL_DIRECTIONS,
    turns: [Direction.rotateRight45]
  });

  digger.addPerimeterWall();
};
