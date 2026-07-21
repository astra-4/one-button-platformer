const themes = [
    {
        name: "Minimal",
        background: "#f2efe9",
        ground: "#3f8f8f",
        groundTop: "#59b0b0",
        platform: "#e0a339",
        spike: "#c1432b",
        player: "#e2823f",
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
const JUMP_SPEED = -970;
const DOUBLE_JUMP_SPEED = -970 * 0.88;
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
    const levelMultiplier = 1 + (levelNumber - 1) * 0.15;
    const spikeChance = Math.min(0.35 + (levelNumber - 1) * 0.03, 0.55);
    const speedMultiplier = 1 + (levelNumber - 1) * 0.08;

    const grounds = [];
    const platforms = [];
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

function getPlatformPosition(platform, t) {
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
    document.getElementById("levelDisplay").textContent = "Level " + levelToStart;
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

canvas.addEventListener("pointerdown", handlePress);

document.addEventListener("keydown", function (event) {
    if (event.code === "Space") {
        event.preventDefault();
        handlePress();
    }
});

//shine uwu
function killPlayer() {
    if (phase !== "playing") return;
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
    document.getElementById("winDistance").textContent = finalDistance;
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
    button.className = "themeButton" + (index === currentThemeIndex ? " active" : "");
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

    let platformDeltaX = 0;
    let platformDeltaY = 0;

    if (p.standingOnPlatform) {
        const before = getPlatformPosition(p.standingOnPlatform, timeSeconds - deltaSeconds);
        const after = getPlatformPosition(p.standingOnPlatform, timeSeconds);
        platformDeltaX = after.x - before.x;
        platformDeltaY = after.y - before.y;
    }

const forwardSpeed = BASE_SPEED + Math.min(p.x * 0.02, 90);
p.x += forwardSpeed * deltaSeconds + platformDeltaX;

p.velocityY += GRAVITY * deltaSeconds;
p.y += p.velocityY * deltaSeconds + (p.onGround ? platformDeltaY : 0);


//check if landed
p.onGround = false;
p.standingOnPlatform = null;

if (p.velocityY >= 0) {
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
        for (const platform of level.platforms) {
            const platPos = getPlatformPosition(platform, timeSeconds);

            const overlapsHorizontally =
            p.x + PLAYER_RADIUS * 0.85 > platPos.x && p.x - PLAYER_RADIUS * 0.85 < platPos.x + platPos.width;

            const crossedThePlataformTop =
            (bottomBefore <= platPos.y + 4 && bottomNow >= platPos.y) || (bottomNow >= platPos.y && bottomNow <= platPos.y + 40);

            if (overlapsHorizontally && crossedThePlataformTop) {
                p.y = platPos.y - PLAYER_RADIUS;
                p.velocityY = 0;
                p.onGround = true;
                p.standingOnPlatform = platform;
                break;
            }
        }
    }
    if (p.onGround) {
        jumpsUsed = 0;
    }

    //is crash?
    for (const spike of level.spikes) {
        const overlapsHorizontally = 
        p.x + PLAYER_RADIUS * 0.5 > spike.x - spike.width / 2 &&
        p.x - PLAYER_RADIUS * 0.5 < spike.x + spike.width / 2;

        if (overlapsHorizontally && p.y + PLAYER_RADIUS > spike.y - 26) {
            killPlayer();
            break;
        }
    }

    //kirby die
    if (p.y - PLAYER_RADIUS > GROUND_Y + 260) {
        killPlayer();
    }

    //checkpoint this
    if (p.x > level.flagX) {
        advanceLevel();
    }

    if (jumpSquashTimer > 0) {
        jumpSquashTimer = Math.max(0, jumpSquashTimer - deltaSeconds);
    }

    document.getElementById("scoreDisplay").textContent = Math.floor(p.x / 20) + "m";
}
}

//los visuales
function drawGame(timeSeconds) {
    const theme = themes[currentThemeIndex];
    const cameraX = Math.max(0, player.x - 250);

    ctx.clearRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);

    //grid
    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const gridOffset = -(cameraX * 0.3) % 60;
    for(let gx = gridOffset; gx < CANVAS_WIDTH; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx,0);
        ctx.lineTo(gx, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let gy=40; gy < CANVAS_HEIGHT; gy += 60) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_WIDTH, gy);
        ctx.stroke();
    }
    ctx.restore();

    //end gridding
    ctx.save();
    ctx.translate(-cameraX, 0);

    //da floor
    for (const ground of level.grounds) {
        if (ground.x2 < cameraX - 20 || ground.x1 > cameraX + CANVAS_WIDTH + 20) continue;
        ctx.fillStyle = theme.ground;
        ctx.fillRect(ground.x1, ground.y, ground.x2 - ground.x1, CANVAS_HEIGHT - ground.y + 40);
        ctx.fillStyle = theme.groundTop;
        ctx.fillRect(ground.x1, ground.y, ground.x2 - ground.x1, 8);
    }

    //moving platforms
    for (const platform of level.platforms) {
        const pos = getPlatformPosition(platform,timeSeconds);
        if (pos.x + pos.width < cameraX - 20 || pos.x > cameraX + CANVAS_WIDTH + 20) continue;

        ctx.fillStyle = theme.platform;
        if (theme.glow) {
            ctx.shadowColor = theme.platform;
            ctx.shadowBlur = 18;
        }
        ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
        ctx.shadowBlur = 0;
    }

    //drawing spikes
    for (const spike of level.spikes) {
        if (spike.x < cameraX - 30 || spike.x > cameraX + CANVAS_WIDTH + 30) continue;
        ctx.fillStyle = theme.spike;

        const numberOfTeeth = 3;
        for (let i = 0; i < numberOfTeeth; i++) {
            const toothX = spike.x - spike.width / 2 + (i * spike.width) / numberOfTeeth;
            ctx.beginPath();
            ctx.moveTo(toothX, spike.y);
            ctx.lineTo(toothX + spike.width / numberOfTeeth / 2, spike.y - 26);
            ctx.lineTo(toothX + spike.width / numberOfTeeth, spike.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    //flag
    if (level.flagX > cameraX - 20 && level.flagX < cameraX + CANVAS_WIDTH + 20) {
        ctx.fillStyle = theme.flag;
        ctx.fillRect(level.flagX, GROUND_Y - 90, 4, 90);
        ctx.beginPath();
        ctx.moveTo(level.flagX + 4, GROUND_Y - 90);
        ctx.lineTo(level.flagX + 40, GROUND_Y - 78);
        ctx.lineTo(level.flagX + 4, GROUND_Y - 66);
        ctx.closePath();
        ctx.fill();
    }

    //el squishie
    const squashProgress = jumpSquashTimer / SQUASH_DURATION;
    const scaleY = 1 * (1 - squashProgress) + squashProgress * 1.35;
    const scaleX = 1 * (1 - squashProgress) + squashProgress * 0.75;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(scaleX, scaleY);

    if(theme.glow) {
        ctx.shadowColor = theme.player;
        ctx.shadowBlur = 22;
    }

    ctx.fillStyle = theme.player;

    if(theme.blockSprite) {
        ctx.fillRect(-PLAYER_RADIUS, -PLAYER_RADIUS, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);
        ctx.fillStyle = "#0c0c14";
        ctx.fillRect(PLAYER_RADIUS * 0.15, -PLAYER_RADIUS * 0.4, 6, 6);
    } else {
        ctx.beginPath();
        ctx.arc(0,0,PLAYER_RADIUS, 0 , Math.PI * 2);
        ctx.fill();

        if (theme.cartoon) {
            ctx.fillStyle = "#33425a";
            ctx.beginPath();
            ctx.arc(6,-4,2.6,0,Math.PI *2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-6,-4,2.6,0,Math.PI*2);
            ctx.fill();
        }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
}

//loop
function gameLoop(now) {
    const deltaSeconds = Math.min((now-lastFrameTime) / 1000, 0.032);
    lastFrameTime = now;
    const timeSeconds = (now-startTime) / 1000;

    if (phase === "playing") {
        updateGame(deltaSeconds, timeSeconds);
    }

    drawGame(timeSeconds);

    requestAnimationFrame(gameLoop);
}

//start
resetGame(1);
lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);