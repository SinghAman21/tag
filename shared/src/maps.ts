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
  name: "Compact Stage",
  width: 1100,
  height: 700,
  obstacles: [
    ...sideWalls(1100, 700),
    platform(0, 635, 260),
    platform(330, 635, 420),
    platform(830, 635, 270),
    platform(150, 520, 360),
    platform(620, 500, 380),
    platform(0, 400, 210),
    platform(360, 380, 390),
    platform(820, 300, 280),
    platform(260, 250, 300),
    // Tactical cover trees
    coverTree(300, 520),
    coverTree(480, 380),
  ],
  spawnPoints: [
    onPlatform(400, 635),
    onPlatform(470, 635),
    onPlatform(540, 635),
    onPlatform(610, 635),
    onPlatform(230, 520),
    onPlatform(760, 500),
    onPlatform(70, 400),
    onPlatform(900, 300),
    onPlatform(350, 250),
    onPlatform(670, 380),
    onPlatform(80, 635),
    onPlatform(980, 635),
    onPlatform(900, 635),
  ],
  powerUpSpawns: [
    abovePlatform(340, 250),
    abovePlatform(680, 380),
    abovePlatform(870, 300),
    abovePlatform(230, 520),
    abovePlatform(700, 500),
    abovePlatform(550, 635),
  ],
  scenery: [
    { type: "tree", x: 50, y: 400, scale: 0.8 },
    { type: "bush", x: 200, y: 635, scale: 0.75 },
    { type: "bush", x: 860, y: 300, scale: 0.7 },
  ],
};

export const OPEN_STAGE: GameMap = {
  name: "Open Stage",
  width: 1300,
  height: 760,
  obstacles: [
    ...sideWalls(1300, 760),
    platform(0, 700, 420),
    platform(520, 700, 780),
    platform(160, 585, 360),
    platform(650, 560, 460),
    platform(0, 455, 280),
    platform(420, 435, 350),
    platform(930, 335, 370),
    platform(360, 300, 580),
    // Tactical cover trees
    coverTree(980, 700),
    coverTree(620, 300),
  ],
  spawnPoints: [
    onPlatform(570, 700),
    onPlatform(650, 700),
    onPlatform(730, 700),
    onPlatform(810, 700),
    onPlatform(260, 585),
    onPlatform(760, 560),
    onPlatform(110, 455),
    onPlatform(1040, 335),
    onPlatform(500, 300),
    onPlatform(820, 300),
    onPlatform(100, 700),
    onPlatform(1150, 700),
    onPlatform(680, 435),
  ],
  powerUpSpawns: [
    abovePlatform(520, 300),
    abovePlatform(840, 300),
    abovePlatform(690, 435),
    abovePlatform(1040, 335),
    abovePlatform(280, 585),
    abovePlatform(760, 560),
  ],
  scenery: [
    { type: "tree", x: 80, y: 455, scale: 0.9 },
    { type: "tree", x: 1100, y: 335, scale: 0.85 },
    { type: "bush", x: 220, y: 700, scale: 0.8 },
    { type: "bush", x: 740, y: 560, scale: 0.75 },
  ],
};

export const MAPS: Record<string, GameMap> = {
  arena: SKYLINE_STAGE,
  small_arena: COMPACT_STAGE,
  open_field: OPEN_STAGE,
};

export const MAP_NAMES: Record<string, string> = {
  arena: "Skyline Stage",
  small_arena: "Compact Stage",
  open_field: "Open Stage",
};
