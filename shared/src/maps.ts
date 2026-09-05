import type { GameMap, Obstacle } from "./types.js";

const FIELD_W = 1600;
const FIELD_H = 900;
const PLATFORM_H = 22;
const PLAYER_H = 32;

function platform(x: number, y: number, w: number): Obstacle {
  return { x, y, w, h: PLATFORM_H, type: "platform" };
}

function coverTree(x: number, platformY: number): Obstacle {
  return { x, y: platformY - 58, w: 32, h: 58, type: "cover_tree" };
}

function onPlatform(x: number, platformY: number) {
  return { x, y: platformY - PLAYER_H };
}

function abovePlatform(x: number, platformY: number) {
  return { x, y: platformY - 36 };
}

function sideWalls(width: number, height: number): Obstacle[] {
  return [
    { x: -24, y: 0, w: 24, h: height, type: "wall" },
    { x: width, y: 0, w: 24, h: height, type: "wall" },
  ];
}

export const SKYLINE_STAGE: GameMap = {
  name: "Skyline Stage",
  theme: "skyline",
  width: FIELD_W,
  height: FIELD_H,
  obstacles: [
    ...sideWalls(FIELD_W, FIELD_H),
    platform(0, 820, 250),
    platform(290, 820, 260),
    platform(770, 790, 380),
    platform(1320, 800, 280),
    platform(230, 680, 880),
    platform(1350, 665, 250),
    platform(0, 555, 240),
    platform(350, 540, 650),
    platform(980, 410, 570),
    platform(280, 390, 380),
    platform(640, 265, 380),
    platform(1340, 280, 260),
    // Tactical cover trees on platforms
    coverTree(320, 680),
    coverTree(1200, 410),
  ],
  spawnPoints: [
    onPlatform(620, 540),
    onPlatform(700, 540),
    onPlatform(780, 540),
    onPlatform(860, 540),
    onPlatform(460, 680),
    onPlatform(980, 680),
    onPlatform(90, 820),
    onPlatform(1420, 800),
    onPlatform(360, 390),
    onPlatform(1460, 280),
    onPlatform(760, 265),
    onPlatform(1060, 410),
    onPlatform(900, 790),
  ],
  powerUpSpawns: [
    abovePlatform(460, 390),
    abovePlatform(790, 265),
    abovePlatform(1420, 280),
    abovePlatform(1020, 410),
    abovePlatform(450, 680),
    abovePlatform(1030, 680),
    abovePlatform(180, 820),
    abovePlatform(1450, 800),
  ],
  scenery: [
    { type: "tree", x: 120, y: 555, scale: 0.9 },
    { type: "tree", x: 1400, y: 665, scale: 0.85 },
    { type: "bush", x: 80, y: 820, scale: 0.8 },
    { type: "bush", x: 840, y: 790, scale: 0.75 },
    { type: "bush", x: 740, y: 265, scale: 0.7 },
  ],
};

export const COMPACT_STAGE: GameMap = {
  name: "Neon Rooftops Stage",
  theme: "neon_rooftops",
  width: FIELD_W,
  height: FIELD_H,
  obstacles: [
    ...sideWalls(FIELD_W, FIELD_H),
    // Tight vertical rooftop lanes with short gaps for fast jumps and reversals.
    platform(0, 823, 262),
    platform(371, 823, 342),
    platform(887, 823, 327),
    platform(1338, 823, 262),
    platform(175, 688, 349),
    platform(662, 656, 313),
    platform(1120, 681, 364),
    platform(0, 540, 240),
    platform(407, 508, 349),
    platform(887, 495, 335),
    platform(1338, 527, 262),
    platform(247, 360, 378),
    platform(815, 321, 378),
    // Tactical cover columns/signs, kept as cover_tree for existing collision logic.
    coverTree(454, 508),
    coverTree(1018, 495),
  ],
  spawnPoints: [
    onPlatform(415, 823),
    onPlatform(516, 823),
    onPlatform(945, 823),
    onPlatform(1062, 823),
    onPlatform(276, 688),
    onPlatform(778, 656),
    onPlatform(1251, 681),
    onPlatform(80, 540),
    onPlatform(538, 508),
    onPlatform(902, 495),
    onPlatform(1411, 527),
    onPlatform(378, 360),
    onPlatform(967, 321),
  ],
  powerUpSpawns: [
    abovePlatform(415, 360),
    abovePlatform(1004, 321),
    abovePlatform(589, 508),
    abovePlatform(1040, 495),
    abovePlatform(1273, 681),
    abovePlatform(524, 823),
    abovePlatform(1069, 823),
  ],
  scenery: [
    { type: "billboard", x: 138, y: 540, scale: 1.05 },
    { type: "antenna", x: 1425, y: 527, scale: 1 },
    { type: "sign", x: 836, y: 656, scale: 0.95 },
    { type: "crate", x: 1171, y: 823, scale: 0.95 },
  ],
};

export const OPEN_STAGE: GameMap = {
  name: "Desert Ruins Stage",
  theme: "desert_ruins",
  width: FIELD_W,
  height: FIELD_H,
  obstacles: [
    ...sideWalls(FIELD_W, FIELD_H),
    // Wide sandy ruins with bigger sightlines and separated island routes.
    platform(0, 835, 382),
    platform(529, 835, 517),
    platform(1243, 835, 357),
    platform(172, 699, 320),
    platform(652, 669, 308),
    platform(1108, 693, 320),
    platform(0, 557, 283),
    platform(418, 515, 320),
    platform(886, 521, 308),
    platform(1329, 539, 271),
    platform(228, 373, 345),
    platform(763, 343, 369),
    platform(1249, 326, 351),
    // Tactical cover pillars, kept as cover_tree for existing collision logic.
    coverTree(683, 669),
    coverTree(1403, 539),
  ],
  spawnPoints: [
    onPlatform(578, 835),
    onPlatform(677, 835),
    onPlatform(800, 835),
    onPlatform(935, 835),
    onPlatform(271, 699),
    onPlatform(800, 669),
    onPlatform(1206, 693),
    onPlatform(92, 557),
    onPlatform(529, 515),
    onPlatform(991, 521),
    onPlatform(1489, 539),
    onPlatform(351, 373),
    onPlatform(911, 343),
  ],
  powerUpSpawns: [
    abovePlatform(382, 373),
    abovePlatform(923, 343),
    abovePlatform(1397, 326),
    abovePlatform(554, 515),
    abovePlatform(1028, 521),
    abovePlatform(302, 699),
    abovePlatform(1218, 693),
    abovePlatform(812, 835),
  ],
  scenery: [
    { type: "cactus", x: 86, y: 835, scale: 1 },
    { type: "rock", x: 332, y: 835, scale: 1.05 },
    { type: "obelisk", x: 1378, y: 326, scale: 1 },
    { type: "crate", x: 732, y: 835, scale: 0.9 },
    { type: "cactus", x: 1502, y: 835, scale: 1.15 },
  ],
};

export const MAPS: Record<string, GameMap> = {
  arena: SKYLINE_STAGE,
  small_arena: COMPACT_STAGE,
  open_field: OPEN_STAGE,
};

export const MAP_NAMES: Record<string, string> = {
  arena: "Skyline Stage",
  small_arena: "Neon Rooftops Stage",
  open_field: "Desert Ruins Stage",
};
