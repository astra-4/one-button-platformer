const themes = [
    {
        name: "Minimal",
        background: "#f2efe9",
        ground: "#3f8f8f",
        groundTop: "#59b0b0",
        platform: "#e0a339",
        spike: "#c1432b",
        player: "e2823f",
        flag: "#2b2b2b",
        grid: "rgba(0,0,0,0.05)"
    },
    {
        name: "Arcade Classic",
        background: "#0c0c14",
        ground: "#3ddc84",
        groundTop: "#9dfcc0",
        platform: "#ffd23d",
        spike: "#ff4d4d",
        player: "#ffd23d",
        flag: "#3ddc84",
        grid: "rgba(255,255,255,0.06)",
        blockSprite: true
    },
    {
        name: "Neon",
        background: "#1a0b2e",
        ground: "#ff2fd0",
        groundTop: "#ff8bf0",
        platform: "#2fe6ff",
        spike: "#ff2f5e",
        player: "#2fe6ff",
        flag: "#ff2fd0",
        grid: "rgba(255,47,208,0.18)",
        glow: true
    },
    {
        name: "Storybook",
        background: "#bfe6ff",
        ground: "#7bc96f",
        groundTop: "#9fe58f",
        platform: "#ffb84d",
        spike: "#e85d5d",
        player: "#ff9ecb",
        flag: "#7a5cff",
        grid: "rgba(255,255,255,0.4)",
        cartoon: true
    }
];

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
        x: 60,
        y: GROUND_Y - PLAYER_RADIUS,
        velocityY: 0,
        onGround: true,
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
    currentLevel += 1;
    checkpointLevel = currentLevel;
    level = buildLevel(currentLevel, level.flagX);
    document.getElementById("levelDisplay").textContent = "Level " + currentLevel;
}

//jump
function handlePress() {
    if (phase === "idle") {
        phase = "playing";
        updateOverlays();
        return;
    }

    if (phase !== "playing") {
        return;
    }

    if (player.onGround) {
        player.velocityY = JUMP_SPEED;
        player.onGround = false;
        player.standingOnPlatform = null;
        jumpsUsed = 1;
        jumpSquashTimer = SQUASH_DURATION;
    } else if (jumpsUsed < 2) {
        player.velocityY = DOUBLE_JUMP_SPEED;
        jumpsUsed = 2;
        jumpSquashTimer = SQUASH_DURATION;
    }
}

canvas.addEventListener("poitnerdown", handlePress);

document.addEventListener("keydown", function (event) {
    if (event.code === "Space") {
        event.preventDefault();
        handlePress();
    }
});

//shine uwu
function killPlayer() {
    if (phase !== "Playing") return;
    finalDistance = Math.floor(player.x / 20);
    phase = "dead";
    document.getElementById("deadDistance").textContent = finalDistance;
    document.getElementById("deadCheckpoint").textContent = checkpointLevel;
    updateOverlays();
}

function winGame() {
    if (phase !== "playing") return;
    finalDistance = Math.floor(player.x / 20);
    phase = "win";
    document.getElementById("winDisdance").textContent = finalDistance;
    updateOverlays();
}

document.getElementById("retryButton").addEventListener("click", function () {
    resetGame(checkpointLevel);
    phase = "idle";
    updateOverlays();
});

document.getElementById("playAgainButton").addEventListener("click", function () {
    checkpointLevel = 1;
    resetGame(1);
    phase = "idle";
    updateOverlays();
});

function updateOverlays() {
    document.getElementById("idleOverlay").classList.toggle("hidden", phase !== "idle");
    document.getElementById("deadOverlay").classList.toggle("hidden", phase !== "dead");
    document.getElementById("winOverlay").classList.toggle("hidden", phase !== "win");
}

//themes swicher outer
const themeButtonsContainer = document.getElementById("themeButtons");

themes.forEach(function (theme,index) {
    const button = document.createElement("button");
    button.classname = "themeButton" + (index === currentThemeIndex ? " active" : "");
    button.textContent = theme.name;

    button.addEventListener("click", function () {
        currentThemeIndex = index;

        const allButtons = themeButtonsContainer.querySelectorAll(".themeButton");
        allButtons.forEach(function (b) { b.classList.remove("active"); });
        button.classList.add("active");

        checkpointLevel = 1;
        resetGame(1);
        phase = "idle";
        updateOverlays();
    });

    themeButtonsContainer.appendChild(button);
});


//brrrr skrrt skrrt
function updateGame(deltaSeconds, timeSeconds) {
    const p = player;
    const previousY = p.y;

    let platformDelaX = 0;
    let platformDeltaY = 0;

    if (p.standingOnPlatform) {
        const before = getPlaformPosition(p.standingOnPlatform, timeSeconds - deltaSeconds);
        const after = getPlaformPosition(p.standingOnPlatform, timeSeconds);
        platformDeltaY = after.x - before.x;
        platformDeltaY = after.y - before.y;
    }
}

const forwardSpeed = BASE_SPEED + Math.min(p.x * 0.02, 90);
p.x += forwardSPeed * deltaSeconds + platformDeltaX;

p.velocityY += GRAVITY * deltaSeconds;
p.y += p.velocityY * deltaSeconds + (p.onGround ? platformDeltaY : 0);


//check if landed
p.onGround = false;
p.standingOnPlatform = null;

if (p.velocity >= 0) {
    const bottomBefore = previousY + PLAYER_RADIUS;
    const bottomNow = p.y + PLAYER_RADIUS;

    for (const ground of level.grounds) {
        const overlapsHorizontally = 
        p.x + PLAYER_RADIUS * 0.85 > ground.x1 &&
        p.x - PLAYER_RADIUS * 0.85 < ground.x2;

        const crossedTheGroundLine =
        (bottomBefore <= ground.y + 4 && bottomNow >= ground.y) || (bottomNow >= ground.y && bottomNow <= ground.y + 40);

        if (overlapsHorizontally && crossedTheGroundLine) {
            p.y = ground.y - PLAYER_RADIUS;
            p.velocityY = 0;
            p.onGround = true;
            break;
        }
    }

    if (!p.onGround) {
        for (const platform of level.platform) {
            const platPos = getPlaformPosition(platform, timeSeconds);

            const overlapsHorizontally =
            p.x + PLAYER_RADIUS * 0.85 > platPos.x && p.x - PLAYER_Radius * 0.85 < platPos.x + platPos.width;

            const crossedThePlataformTop =
            (bottomBefore <= platPos.y + 4 && bottomNow >= platPos.y) || (bottomNow >= platPos.y && bottomNow <= platPos.y + 40);

            const platPos = getPlaformPosition(plaform, timeSeconds);

            const overlapsHorizontally = p.x + PLAYER_RADIUS * 0.85 > platPos.x && p.x - PLAYER_RADIUS * 0.85 < platPos.x + platPos.width;

            const crossedThePlataformTop = (bottomBefore <= platPos.y + 4 && bottomNow >= platPos.y) || (bottomNow >= platPos.y && bottomNow <= platPos.y + 40);

            if (overlapsHorizontally && crossedThePlataformTop) {
                p.y = platPos.y - PLAYER_RADIUS;
                p.velocityY = 0;
                p.onGround = true;
                p.standingOnPlatform = platform;
                break;
            }
        }
    }
}

if (p.onGround) {
    jumpsUsed = 0;
}