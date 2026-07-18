const themes = {
    {
        name: "Minimal"
    }
};

let currentThemeIndex = 0;

//canvas type hsi
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;
const GROUND_Y = 420;
const PLAYER_RADIUS = 20;


// game typ shi
const GRAVITY = 3600;
const JUMP_SPEED = -1000;
const DOUBLE_JUMP_SPEED = -1000 * 0.88;
const BASE_SPEED = 260;
const MAX_LEVEL = 8;
const SQUASH_DURATION = 0.08;