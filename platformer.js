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

//stuff
let phase = "idle";
let level = null;
let player = null;
let jumpsUsed = 0;
let jumpSquashTimer = 0;
let startTime = 0;
let lastFrameTime = 0;
let currentLevel = 1;
let checkpointLevel = 1;

//random number generator
function makeSeededRandom(seed) {
    let value = seed;
    return function () {
        value = (value * 1103515245 + 12345) % 2147483648;
        return value / 2147483648;
    };
}



//generating the level -_- and making it harder
function buildLevel(levelNumber, startX) {
    const random = makeSeededRandom(1337 + levelNumber * 97);
    const levelMultiplier = 1 + (levelumber - 1) * 0.15;
    const spikeChance = Math.min(0.35 + (levelNumber - 1) * 0.03, 0.55);
    const speedMultiplier = 1 + (levelNumber - 1) * 0.08;

    const grounds = [];
    const plaforms = [];
    const spikes = [];

    let cursor = startX + 300;
    grounds.push({ x1: startX, x2: cursor, y: GROUND_Y});

    const numberOfSections = 16;

    for (let i = 0; i < numberOfSections; i++) {
        const groundLength = 220 + random() * 150;
        const isBridgedGap = i % 3 ===2;

        let gapLength;

        if (isBridgedGap) {
            gapLength = ( 260 + random() * 70) * levelMultiplier;
            const midpointX=cursor+gapLength/2;
            const movesVertically = random() > 0.5;

            platforms.push({
                baseX: midpointX - 55,
                baseY: GROUND_Y - 10 - random() * 20,
                width: 110,
                height: 18,
                axis: movesVertically ? "y" : "x",
                amplitude: movesVertically ? 35 + random() * 25 : 45 + random() * 30,
                speed: (1.1 + random() * 0.6) * speedMultiplier,
                phase: random() * 6.28
            });
        } else {
            gapLength = (90 + random() * 110) * levelMultiplier;
        }

        const gapStartX = cursor + gapLength;
        const gapEndX = gapStartX + groundLength;
        grounds.push({ x1: gapStartX, x2: gapEndX, y: GROUND_Y});

        //spikyy
        if (!isBridgedGap && random() < spikeChance && groundLength > 220) {
            const spikeWidth = 34;
            const landingBuffer = 110;
            const maxSpikeX = gapEndX - landingBuffer - spikeWidth / 2;
            const minSpikeX = gapStartX + landingBuffer + spikeWidth / 2;

            if (maxSpikeX > minSpikeX) {
                const spikeX = minSpikeX + random() * (maxSpikeX - minSpikeX);
                spikes.push({x: spikeX, width: spikeWidth, y: GROUND_Y});
            }
        }

        cursor = gapEndX;
    }

    const flagX = cursor + 120;
    grounds.push({x1: cursor, x2: flagX + 260, y: GROUND_Y})

    return { grounds,platforms,spikes,flagX};
}

function getPlaformPosition(platform, t) {
    let x = platform.baseX;
    let y = platform.baseY;

    if (platform.axis === "y") {
        y = platform.baseY + Math.sin(t * platform.speed + platform.phase) * platform.amplitude;
    } else {
        x = platform. baseX + Math.sin(t * platform.speed + platform. phase) * platform.amplitude;
    }

    return {x:x, y:y, width: platform.width,height: platform.height};
}


//respawn type shi
function resetGame(startLevel) {
    const levelToStart = startLevel || 1;
    currentLevel = levelToStart;
    level = buildLevel(levelToStart, 0);
    player = {
        x: 60;
        y: GROUND_Y - PLAYER_RADIUS,
        velocityY: 0;
        onGround: true;
        standingOnPlatform: null
    };
    jumpsUsed = 0;
    jumpSquashTimer = 0;
    startTime = performance.now();
    document.getElementById("leveldisplay").textContent = "Level " + levelToStart;
}

//checkpoint this
function advanceLevel() {
    if (currentLevel >= MAX_LEVEL) {
        winGame();
        return;
    }
}