"use strict";

/*
=========================================================
ELEMENTY HTML
=========================================================
*/

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("scoreDisplay");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const boosterStatus = document.getElementById("boosterStatus");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScore = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const soundButton = document.getElementById("soundButton");
const pauseScreen = document.getElementById("pauseScreen");
const comboDisplay = document.getElementById("comboDisplay");
const difficultyDisplay = document.getElementById("difficultyDisplay");
const finalBest = document.getElementById("finalBest");
const finalCombo = document.getElementById("finalCombo");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

/*
Natywne renderowanie pełnoekranowe.

Canvas ma dokładnie tyle fizycznych pikseli, ile aktualnie potrzebuje ekran.
Świat gry nadal używa wygodnego układu 960 × 540, ale jest skalowany metodą
"cover" bez rozciągania proporcji. Nadmiar obrazu po bokach albo u góry jest
symetrycznie przycinany, dzięki czemu wszystkie grafiki pozostają ostre.
*/
let pixelRatio = 1;
let viewportWidth = GAME_WIDTH;
let viewportHeight = GAME_HEIGHT;
let renderScale = 1;
let renderOffsetX = 0;
let renderOffsetY = 0;

function applyGameTransform() {
    ctx.setTransform(
        pixelRatio * renderScale,
        0,
        0,
        pixelRatio * renderScale,
        pixelRatio * renderOffsetX,
        pixelRatio * renderOffsetY
    );
}

function configureCanvasQuality() {
    const rect = canvas.getBoundingClientRect();
    viewportWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
    viewportHeight = Math.max(1, Math.round(rect.height || window.innerHeight));

    // Ograniczenie pamięci tylko na ekstremalnie gęstych ekranach.
    // Typowe Full HD, 2K, 4K i Retina nadal renderują się bardzo ostro.
    const nativeRatio = Math.max(1, window.devicePixelRatio || 1);
    const maxBackingPixels = 16_000_000;
    const safeRatio = Math.sqrt(
        maxBackingPixels / Math.max(1, viewportWidth * viewportHeight)
    );
    pixelRatio = Math.max(1, Math.min(nativeRatio, 3, safeRatio));

    canvas.width = Math.max(1, Math.round(viewportWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(viewportHeight * pixelRatio));

    renderScale = Math.max(
        viewportWidth / GAME_WIDTH,
        viewportHeight / GAME_HEIGHT
    );
    renderOffsetX = (viewportWidth - GAME_WIDTH * renderScale) / 2;
    renderOffsetY = (viewportHeight - GAME_HEIGHT * renderScale) / 2;

    applyGameTransform();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
}

configureCanvasQuality();

/*
Ustaw na true, jeśli chcesz zobaczyć hitboxy.
*/

const DEBUG_HITBOXES = false;

/*
=========================================================
WCZYTYWANIE GRAFIK
=========================================================
*/

function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
}

const images = {
    background: loadImage("assets/background.png"),

    player: loadImage("assets/player.png"),
    playerCoin: loadImage("assets/player_coin.png"),
    playerBooster: loadImage("assets/player_booster.png"),

    obstacleTop: loadImage("assets/obstacle_top.png"),
    obstacleBottom: loadImage("assets/obstacle_bottom.png"),

    coin: loadImage("assets/coin.png"),
    booster: loadImage("assets/booster.png"),
    slotPickup: loadImage("assets/slot_pickup.png")
};

function imageReady(image) {
    return Boolean(
        image &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    );
}

/*
=========================================================
USTAWIENIA GRY
=========================================================
*/

const settings = {
    /*
    Fizyka gracza.
    */

    gravity: 0.13,
    jumpStrength: -3.8,
    jumpImpulse: 1.8,
    maxFallSpeed: 3.8,

    /*
    Prędkość świata.
    */

    worldSpeed: 2.8,

    /*
    Booster.
    */

    boosterSpeedMultiplier: 1.32,
    boosterDuration: 5000,

    boosterIntervalMin: 70,
    boosterIntervalMax: 95,

    /*
    Punkty.
    */

    obstaclePoints: 1,
    coinPoints: 3,
    boostedCoinPoints: 6,

    /*
    =====================================================
    ROZMIAR PRZESZKÓD
    =====================================================

    obstacleWidth:
    szerokość grafiki przeszkody.

    obstacleDrawHeight:
    wysokość całej grafiki przeszkody.

    Te dwie wartości możesz swobodnie edytować.
    */

    obstacleWidth: 155,
    obstacleDrawHeight: 430,

    /*
    =====================================================
    MAKSYMALNE PRZESUNIĘCIE PRZESZKODY
    =====================================================

    obstacleMaxHide: 250 oznacza:

    - górna przeszkoda może zostać przesunięta
      maksymalnie 250 px ponad ekran,

    - dolna przeszkoda może zostać przesunięta
      maksymalnie 250 px pod ekran.
    */

    obstacleMaxHide: 130,

    /*
    Minimalne schowanie przeszkody.

    Ustaw 0, jeśli przeszkoda może być całkowicie
    wysunięta na planszę.
    */

    obstacleMinHide: 0,

    /*
    Minimalna widoczna część przeszkody.

    Jest to dodatkowe zabezpieczenie na wypadek,
    gdyby wysokość grafiki była mniejsza.
    */

    obstacleMinVisible: 140,

    /*
    Przejścia między podwójnymi przeszkodami.
    */

    normalGapMin: 175,
    normalGapMax: 215,

    narrowGapMin: 140,
    narrowGapMax: 165,

    veryNarrowGapMin: 120,
    veryNarrowGapMax: 138,

    /*
    Odległości pomiędzy przeszkodami.
    */

    obstacleSpacingMin: 290,
    obstacleSpacingMax: 520,
    minimumLateGameSpacing: 220,

    /*
    Monety i booster.
    */

    coinSize: 44,
    boosterSize: 60,

    coinFaceDuration: 250,

    /*
    Zmiana koloru tła.
    */

    glowEveryPoints: 50,
    glowTransitionDuration: 1200,
    glowOverlayOpacity: 0.36,

    /* Lekkie efekty wizualne. */
    particlesEnabled: !window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

/*
=========================================================
STAN GRY
=========================================================
*/

const GAME_STATE = {
    READY: "ready",
    RUNNING: "running",
    GAME_OVER: "gameOver",
    PAUSED: "paused"
};

let gameState = GAME_STATE.READY;

let score = 0;

let bestScore = Number(
    localStorage.getItem("flappyBestScore") || 0
);

let obstacles = [];
let coins = [];
let boosters = [];
let mysteryItems = [];
let rareItems = [];
let particles = [];
let weatherParticles = [];
let ambientEventParticles = [];
let activeEvent = null;
let eventEndTime = 0;
let nextLightningTime = 0;
let lightningFlash = 0;
let windGust = 0;
let nextEventScore = 18;
let fever = 0;
let feverEndTime = 0;
let magnetEndTime = 0;
let doubleCoinEndTime = 0;
let extraLives = 0;
let screenShake = 0;
let combo = 0;
let maxCombo = 0;
let shieldCharges = 0;
let slowEndTime = 0;
let soundEnabled = localStorage.getItem("flappySound") !== "off";
let audioContext = null;

let boosterEndTime = 0;
let coinFaceEndTime = 0;

let pendingBooster = false;
let nextBoosterScore = 0;

let lastFrameTime = performance.now();

let previousObstaclePattern = "";
let repeatedPatternCount = 0;

/*
=========================================================
GRACZ
=========================================================
*/

const player = {
    x: 180,
    y: GAME_HEIGHT / 2 - 32,

    width: 64,
    height: 64,

    velocityY: 0,

    collisionPaddingX: 14,
    collisionPaddingY: 13
};

/*
=========================================================
KOLORY TŁA
=========================================================
*/

const glowColors = [
    { r: 0, g: 0, b: 0 },
    { r: 25, g: 115, b: 255 },
    { r: 170, g: 40, b: 255 },
    { r: 255, g: 80, b: 20 },
    { r: 255, g: 25, b: 70 },
    { r: 0, g: 220, b: 175 },
    { r: 245, g: 185, b: 15 }
];

let currentGlowStage = 0;

let previousGlowColor = {
    r: 0,
    g: 0,
    b: 0
};

let targetGlowColor = {
    r: 0,
    g: 0,
    b: 0
};

let glowTransitionStart = performance.now();

/*
=========================================================
FUNKCJE POMOCNICZE
=========================================================
*/

function clamp(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(maximum, value)
    );
}

function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
}

function randomInteger(minimum, maximum) {
    return Math.floor(
        randomBetween(minimum, maximum + 1)
    );
}

function chooseRandom(array) {
    return array[
        randomInteger(0, array.length - 1)
    ];
}

function rectanglesOverlap(first, second) {
    return (
        first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y
    );
}

function isBoosterActive(now = performance.now()) {
    return now < boosterEndTime;
}

function isFeverActive(now = performance.now()) { return now < feverEndTime; }
function isMagnetActive(now = performance.now()) { return now < magnetEndTime; }
function isDoubleCoinActive(now = performance.now()) { return now < doubleCoinEndTime; }

function getDifficultyLevel() {
    return Math.min(8, 1 + Math.floor(score / 20));
}

function getCurrentWorldSpeed(now = performance.now()) {
    // Poziomy przyspieszają bardzo łagodnie: maksymalnie o 28%.
    const difficultyMultiplier = 1 + Math.min(0.28, score * 0.0025);
    const feverMultiplier = isFeverActive(now) ? 1.10 : 1;
    const normalSpeed = settings.worldSpeed * difficultyMultiplier * feverMultiplier;

    // Przyspieszenie ma pierwszeństwo przed spowolnieniem, więc zawsze jest
    // wyraźnie szybsze od aktualnej prędkości poziomu.
    if (isBoosterActive(now)) {
        return normalSpeed * settings.boosterSpeedMultiplier;
    }

    if (now < slowEndTime) {
        return normalSpeed * 0.72;
    }

    return normalSpeed;
}

function tone(frequency, duration = 0.08, type = "sine", volume = 0.05) {
    if (!soundEnabled) return;
    try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {}
}

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

/*
Zwraca bezpieczny zakres przesunięcia przeszkody.

Przeszkoda nigdy nie zostanie schowana bardziej
niż obstacleMaxHide, czyli domyślnie 250 px.
*/

function getObstacleHideRange() {
    const maximumAllowedByImage = Math.max(
        0,
        settings.obstacleDrawHeight -
        settings.obstacleMinVisible
    );

    const maximumHide = clamp(
        settings.obstacleMaxHide,
        0,
        maximumAllowedByImage
    );

    const minimumHide = clamp(
        settings.obstacleMinHide,
        0,
        maximumHide
    );

    return {
        minimumHide,
        maximumHide
    };
}

/*
=========================================================
CZĄSTECZKI I EFEKTY
=========================================================
*/

function emitParticles(x, y, count, options = {}) {
    if (!settings.particlesEnabled) return;

    for (let i = 0; i < count; i += 1) {
        const angle = randomBetween(0, Math.PI * 2);
        const speed = randomBetween(options.speedMin || 0.7, options.speedMax || 2.6);
        const life = randomBetween(options.lifeMin || 260, options.lifeMax || 620);

        particles.push({
            x, y,
            vx: Math.cos(angle) * speed + (options.driftX || 0),
            vy: Math.sin(angle) * speed + (options.driftY || 0),
            size: randomBetween(options.sizeMin || 2, options.sizeMax || 6),
            life,
            maxLife: life,
            color: options.color || "255,255,255",
            gravity: options.gravity ?? 0.025
        });
    }
}

function updateParticles(frameScale, deltaTime) {
    for (const particle of particles) {
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;
        particle.vy += particle.gravity * frameScale;
        particle.life -= deltaTime;
    }

    particles = particles.filter(particle => particle.life > 0);
}

function drawParticles() {
    ctx.save();
    for (const particle of particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = `rgba(${particle.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/*
=========================================================
RESET GRY
=========================================================
*/

function resetGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    shieldCharges = 0;
    slowEndTime = 0;

    player.x = 180;
    player.y =
        GAME_HEIGHT / 2 -
        player.height / 2;

    player.velocityY = 0;

    obstacles = [];
    coins = [];
    boosters = [];
    mysteryItems = [];
    rareItems = [];
    weatherParticles = [];
    particles = [];
    activeEvent = null;
    eventEndTime = 0;
    nextLightningTime = 0;
    lightningFlash = 0;
    windGust = 0;
    nextEventScore = randomInteger(16, 25);
    fever = 0;
    feverEndTime = 0;
    magnetEndTime = 0;
    doubleCoinEndTime = 0;
    extraLives = 0;
    screenShake = 0;

    boosterEndTime = 0;
    coinFaceEndTime = 0;

    pendingBooster = false;

    nextBoosterScore = randomInteger(
        settings.boosterIntervalMin,
        settings.boosterIntervalMax
    );

    previousObstaclePattern = "";
    repeatedPatternCount = 0;

    currentGlowStage = 0;

    previousGlowColor = {
        r: 0,
        g: 0,
        b: 0
    };

    targetGlowColor = {
        r: 0,
        g: 0,
        b: 0
    };

    glowTransitionStart = performance.now();

    spawnObstacle(GAME_WIDTH + 250);

    updateScoreDisplays();
    updateBoosterDisplay();

    if (finalScore) {
        finalScore.textContent = "0";
    }

    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (pauseScreen) pauseScreen.classList.add("hidden");
    updateEnhancementHud();
}

/*
=========================================================
START, SKOK I KONIEC GRY
=========================================================
*/

function startGame() {
    if (gameState === GAME_STATE.GAME_OVER) {
        return;
    }

    if (gameState === GAME_STATE.READY) {
        gameState = GAME_STATE.RUNNING;

        if (startScreen) {
            startScreen.classList.add("hidden");
        }

        player.velocityY = settings.jumpStrength;
        return;
    }

    flap();
}

function flap() {
    if (gameState !== GAME_STATE.RUNNING) return;
    tone(520, 0.055, "sine", 0.035);
    vibrate(8);

    const eventJumpMultiplier = activeEvent === "snow" ? 0.86 : activeEvent === "rain" ? 1.06 : 1;
    player.velocityY -= settings.jumpImpulse * eventJumpMultiplier;

    if (player.velocityY < settings.jumpStrength) {
        player.velocityY = settings.jumpStrength;
    }

    emitParticles(
        player.x + 10,
        player.y + player.height * 0.65,
        5,
        { color: "220,245,255", driftX: -1.2, sizeMax: 4, lifeMax: 360 }
    );
}

function endGame() {
    if (gameState !== GAME_STATE.RUNNING) return;
    if (extraLives > 0) {
        extraLives -= 1;
        player.y = GAME_HEIGHT / 2 - player.height / 2;
        player.velocityY = settings.jumpStrength * 0.55;
        obstacles = obstacles.filter(o => o.x > player.x + 170 || o.x + o.width < player.x - 60);
        screenShake = 7;
        tone(620, .25, "triangle", .06);
        vibrate([30,25,50]);
        showEventBanner("❤️ DRUGA SZANSA", "Wracasz do gry!");
        emitParticles(player.x+32, player.y+32, 36, {color:"255,90,130", speedMax:5.5, sizeMax:8});
        updateEnhancementHud();
        return;
    }
    if (shieldCharges > 0) {
        shieldCharges -= 1;
        player.velocityY = settings.jumpStrength * 0.65;
        player.y = clamp(player.y, 18, GAME_HEIGHT - player.height - 18);
        screenShake = 5;
        tone(240, 0.18, "square", 0.045);
        vibrate([25, 25, 35]);
        emitParticles(player.x + 32, player.y + 32, 28, {color:"90,220,255", speedMax:5, sizeMax:7});
        updateEnhancementHud();
        return;
    }

    gameState = GAME_STATE.GAME_OVER;
    tone(120, 0.35, "sawtooth", 0.06);
    vibrate([40, 30, 80]);
    screenShake = 10;
    emitParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        24,
        { color: "255,125,70", speedMax: 4.8, sizeMax: 8, lifeMax: 850, gravity: 0.06 }
    );

    if (score > bestScore) {
        bestScore = score;

        localStorage.setItem(
            "flappyBestScore",
            String(bestScore)
        );
    }

    if (finalScore) finalScore.textContent = String(score);
    if (finalBest) finalBest.textContent = String(bestScore);
    if (finalCombo) finalCombo.textContent = String(maxCombo);

    updateScoreDisplays();

    if (gameOverScreen) {
        gameOverScreen.classList.remove("hidden");
    }
}

function restartGame() {
    resetGame();

    gameState = GAME_STATE.READY;

    if (startScreen) {
        startScreen.classList.remove("hidden");
    }
}

/*
=========================================================
LOSOWANIE RODZAJU PRZESZKODY
=========================================================
*/

function chooseObstaclePattern() {
    let availablePatterns;

    if (score < 15) {
        availablePatterns = [
            "top",
            "bottom",
            "top",
            "bottom",
            "pairNormal"
        ];
    } else if (score < 40) {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNormal",
            "pairNarrow"
        ];
    } else if (score < 80) {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNarrow",
            "pairNarrow",
            "pairVeryNarrow"
        ];
    } else {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNarrow",
            "pairNarrow",
            "pairVeryNarrow",
            "pairVeryNarrow"
        ];
    }

    let pattern = chooseRandom(availablePatterns);

    if (
        pattern === previousObstaclePattern &&
        repeatedPatternCount >= 2
    ) {
        const alternatives = availablePatterns.filter(
            item => item !== previousObstaclePattern
        );

        pattern = chooseRandom(alternatives);
    }

    if (pattern === previousObstaclePattern) {
        repeatedPatternCount += 1;
    } else {
        previousObstaclePattern = pattern;
        repeatedPatternCount = 1;
    }

    return pattern;
}

function getRandomObstacleSpacing() {
    const difficultyReduction = Math.min(
        130,
        Math.floor(score / 10) * 10
    );

    const minimum = Math.max(
        settings.minimumLateGameSpacing,
        settings.obstacleSpacingMin -
        difficultyReduction
    );

    const maximum = Math.max(
        minimum + 70,
        settings.obstacleSpacingMax -
        difficultyReduction
    );

    return randomBetween(minimum, maximum);
}

/*
=========================================================
TWORZENIE PRZESZKÓD
=========================================================
*/

function spawnObstacle(startX) {
    const pattern = chooseObstaclePattern();

    let obstacle;

    if (pattern === "top") {
        obstacle = createSingleTopObstacle(startX);
    } else if (pattern === "bottom") {
        obstacle = createSingleBottomObstacle(startX);
    } else if (pattern === "pairNarrow") {
        obstacle = createPairObstacle(
            startX,
            "narrow"
        );
    } else if (pattern === "pairVeryNarrow") {
        obstacle = createPairObstacle(
            startX,
            "veryNarrow"
        );
    } else {
        obstacle = createPairObstacle(
            startX,
            "normal"
        );
    }

    obstacle.spacingAfter = getRandomObstacleSpacing();
    const specialRoll = Math.random();
    obstacle.special = specialRoll < 0.065 ? "gold" : specialRoll < 0.11 ? "pulse" : null;
    obstacle.pulsePhase = Math.random() * Math.PI * 2;

    const previousObstacle =
    obstacles.length > 0
        ? obstacles[obstacles.length - 1]
        : null;

obstacles.push(obstacle);

const safeY =
    getObstacleSafeY(obstacle);

if (Math.random() < 0.075 && score > 5) spawnMysteryItem(obstacle, safeY);
if (Math.random() < 0.035 && score > 10) spawnRareItem(obstacle, safeY);

if (pendingBooster) {
    spawnBooster(obstacle, safeY);
    pendingBooster = false;
} else {
    spawnCoinPattern(
        previousObstacle,
        obstacle
    );
}
}

/*
Górna pojedyncza przeszkoda.

hideOffset nie przekroczy 250 px.
*/

function createSingleTopObstacle(startX) {
    const hideRange = getObstacleHideRange();

    const hideOffset = randomBetween(
        hideRange.minimumHide,
        hideRange.maximumHide
    );

    const visibleHeight = clamp(
        settings.obstacleDrawHeight - hideOffset,
        settings.obstacleMinVisible,
        GAME_HEIGHT - 60
    );

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern: "top",

        topVisible: visibleHeight,
        bottomVisible: 0,

        topHideOffset: hideOffset,
        bottomHideOffset: 0,

        passed: false,
        spacingAfter: 500
    };
}

/*
Dolna pojedyncza przeszkoda.

hideOffset nie przekroczy 250 px.
*/

function createSingleBottomObstacle(startX) {
    const hideRange = getObstacleHideRange();

    const hideOffset = randomBetween(
        hideRange.minimumHide,
        hideRange.maximumHide
    );

    const visibleHeight = clamp(
        settings.obstacleDrawHeight - hideOffset,
        settings.obstacleMinVisible,
        GAME_HEIGHT - 60
    );

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern: "bottom",

        topVisible: 0,
        bottomVisible: visibleHeight,

        topHideOffset: 0,
        bottomHideOffset: hideOffset,

        passed: false,
        spacingAfter: 500
    };
}
function createPairObstacle(startX, gapType) {
    let requestedGap;

    if (gapType === "veryNarrow") {
        requestedGap = randomBetween(
            settings.veryNarrowGapMin,
            settings.veryNarrowGapMax
        );
    } else if (gapType === "narrow") {
        requestedGap = randomBetween(
            settings.narrowGapMin,
            settings.narrowGapMax
        );
    } else {
        requestedGap = randomBetween(
            settings.normalGapMin,
            settings.normalGapMax
        );
    }

    const hideRange = getObstacleHideRange();

    /*
    Minimalna widoczna wysokość wynika z maksymalnego
    schowania grafiki.

    Przykład:
    obstacleDrawHeight = 430
    obstacleMaxHide = 250

    Minimalnie widoczne pozostaje 180 px.
    */

    const minimumVisible = Math.max(
        settings.obstacleMinVisible,
        settings.obstacleDrawHeight -
        hideRange.maximumHide
    );

    const maximumVisible = Math.min(
        GAME_HEIGHT - 60,
        settings.obstacleDrawHeight -
        hideRange.minimumHide
    );

    /*
    Przejście musi zmieścić się pomiędzy przeszkodami.
    */

    const maximumPossibleGap = Math.max(
        100,
        GAME_HEIGHT - minimumVisible * 2
    );

    const gap = clamp(
        requestedGap,
        100,
        maximumPossibleGap
    );

    /*
    Losowanie położenia środka przejścia.

    Zakres pilnuje, aby żadna grafika nie została
    przesunięta bardziej niż obstacleMaxHide.
    */

    const minimumGapCenter =
        minimumVisible +
        gap / 2;

    const maximumGapCenter =
        GAME_HEIGHT -
        minimumVisible -
        gap / 2;

    let gapCenter;

    if (minimumGapCenter <= maximumGapCenter) {
        gapCenter = randomBetween(
            minimumGapCenter,
            maximumGapCenter
        );
    } else {
        gapCenter = GAME_HEIGHT / 2;
    }

    let topVisible =
        gapCenter -
        gap / 2;

    let bottomVisible =
        GAME_HEIGHT -
        (
            gapCenter +
            gap / 2
        );

    topVisible = clamp(
        topVisible,
        minimumVisible,
        maximumVisible
    );

    bottomVisible = clamp(
        bottomVisible,
        minimumVisible,
        maximumVisible
    );

    /*
    Zabezpieczenie, aby przeszkody nie nachodziły
    na przejście po ograniczeniu wartości.
    */

    const currentGap =
        GAME_HEIGHT -
        topVisible -
        bottomVisible;

    if (currentGap < gap) {
        const missingSpace =
            gap - currentGap;

        const topCanHideMore =
            topVisible - minimumVisible;

        const bottomCanHideMore =
            bottomVisible - minimumVisible;

        const totalAvailable =
            topCanHideMore +
            bottomCanHideMore;

        if (totalAvailable > 0) {
            const topReduction =
                Math.min(
                    topCanHideMore,
                    missingSpace *
                    (
                        topCanHideMore /
                        totalAvailable
                    )
                );

            const bottomReduction =
                Math.min(
                    bottomCanHideMore,
                    missingSpace -
                    topReduction
                );

            topVisible -= topReduction;
            bottomVisible -= bottomReduction;
        }
    }

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern:
            gapType === "veryNarrow"
                ? "pairVeryNarrow"
                : gapType === "narrow"
                    ? "pairNarrow"
                    : "pairNormal",

        topVisible,
        bottomVisible,

        topHideOffset:
            settings.obstacleDrawHeight -
            topVisible,

        bottomHideOffset:
            settings.obstacleDrawHeight -
            bottomVisible,

        passed: false,
        spacingAfter: 500
    };
}

/*
=========================================================
BEZPIECZNE MIEJSCE NA MONETY I BOOSTER
=========================================================
*/

function getObstacleSafeY(obstacle) {
    if (
        obstacle.topVisible > 0 &&
        obstacle.bottomVisible > 0
    ) {
        const gapTop = obstacle.topVisible;
        const gapBottom =
            GAME_HEIGHT - obstacle.bottomVisible;

        return (gapTop + gapBottom) / 2;
    }

    if (obstacle.topVisible > 0) {
        return clamp(
            obstacle.topVisible + 140,
            80,
            GAME_HEIGHT - 80
        );
    }

    return clamp(
        GAME_HEIGHT -
            obstacle.bottomVisible -
            140,
        80,
        GAME_HEIGHT - 80
    );
}

/*
=========================================================
TWORZENIE MONET
=========================================================
*/

function coinTouchesObstacle(coin, obstacle) {
    const obstacleBoxes = getObstacleCollisionBoxes(obstacle);

    return obstacleBoxes.some(box => {
        return rectanglesOverlap(coin, box);
    });
}

function coinTouchesAnyObstacle(coin) {
    return obstacles.some(obstacle => {
        const obstacleBoxes = getObstacleCollisionBoxes(obstacle);

        return obstacleBoxes.some(box => {
            return rectanglesOverlap(coin, box);
        });
    });
}

function getObstacleCoinSafeRange(obstacle) {
    const verticalMargin = 45;
    const coinHalf = settings.coinSize / 2;

    let safeTop = verticalMargin + coinHalf;
    let safeBottom =
        GAME_HEIGHT -
        verticalMargin -
        coinHalf;

    if (obstacle) {
        if (obstacle.topVisible > 0) {
            safeTop =
                obstacle.topVisible +
                verticalMargin +
                coinHalf;
        }

        if (obstacle.bottomVisible > 0) {
            safeBottom =
                GAME_HEIGHT -
                obstacle.bottomVisible -
                verticalMargin -
                coinHalf;
        }
    }

    return {
        top: clamp(
            safeTop,
            coinHalf + 15,
            GAME_HEIGHT - coinHalf - 15
        ),

        bottom: clamp(
            safeBottom,
            coinHalf + 15,
            GAME_HEIGHT - coinHalf - 15
        )
    };
}

function coinTouchesAnyObstacle(coin) {
    return obstacles.some(obstacle => {
        const hitboxes =
            getObstacleCollisionBoxes(obstacle);

        return hitboxes.some(hitbox =>
            rectanglesOverlap(coin, hitbox)
        );
    });
}

function coinTouchesAnotherCoin(coin) {
    return coins.some(existingCoin =>
        rectanglesOverlap(coin, existingCoin)
    );
}

function spawnCoinPattern(previousObstacle, obstacle) {
    const coinSize = settings.coinSize;
    const horizontalMargin = 28;
    const preferredSpacing = 52;

    const obstacleWidth =
        obstacle.width ||
        settings.obstacleWidth;

    let zoneStart;

    if (previousObstacle) {
        const previousWidth =
            previousObstacle.width ||
            settings.obstacleWidth;

        zoneStart =
            previousObstacle.x +
            previousWidth +
            horizontalMargin;
    } else {
        zoneStart =
            obstacle.x - 330;
    }

    const zoneEnd =
        obstacle.x -
        horizontalMargin;

    const availableWidth =
        zoneEnd - zoneStart;

    /*
    Nawet przy małej przestrzeni próbujemy
    wygenerować przynajmniej jedną monetę.
    */

    if (availableWidth < coinSize) {
        return;
    }

    let amount = Math.floor(
        availableWidth / preferredSpacing
    );

    amount = clamp(amount, 2, 6);

    /*
    Jeżeli przestrzeń jest bardzo mała,
    pozwalamy również na jedną monetę.
    */

    if (availableWidth < preferredSpacing * 1.4) {
        amount = 1;
    }

    const actualSpacing =
        amount > 1
            ? Math.min(
                preferredSpacing,
                (availableWidth - coinSize) /
                    (amount - 1)
            )
            : 0;

    const totalWidth =
        amount > 1
            ? (amount - 1) * actualSpacing
            : 0;

    const startX =
        zoneStart +
        (availableWidth - totalWidth) / 2 -
        coinSize / 2;

    /*
    Monety tworzą płynną trasę od poprzedniego
    przejścia do aktualnego przejścia.
    */

    const currentSafeY =
        getObstacleSafeY(obstacle);

    const previousSafeY =
        previousObstacle
            ? getObstacleSafeY(previousObstacle)
            : currentSafeY;

    for (let index = 0; index < amount; index += 1) {
        const progress =
            amount === 1
                ? 0.5
                : index / (amount - 1);

        const routeY =
            previousSafeY +
            (currentSafeY - previousSafeY) *
                progress;

        /*
        Delikatny łuk, bez losowego chaosu.
        */

        const arc =
            Math.sin(progress * Math.PI) *
            randomBetween(-18, 18);

        const coin = {
            x:
                startX +
                index * actualSpacing,

            y:
                clamp(
                    routeY + arc - coinSize / 2,
                    20,
                    GAME_HEIGHT - coinSize - 20
                ),

            width: coinSize,
            height: coinSize,
            collected: false,

            animationOffset:
                Math.random() *
                Math.PI *
                2
        };

        /*
        Najpierw próbujemy pozycję na trasie.
        */

        if (!coinTouchesAnyObstacle(coin)) {
            coins.push(coin);
            continue;
        }

        /*
        Jeżeli łuk spowodował kolizję,
        próbujemy bez łuku.
        */

        coin.y = clamp(
            routeY - coinSize / 2,
            20,
            GAME_HEIGHT - coinSize - 20
        );

        if (!coinTouchesAnyObstacle(coin)) {
            coins.push(coin);
        }
    }
}


/*
=========================================================
ZBIERANIE MONETY
=========================================================
*/

function collectCoin(coin, now) {
    if (coin.collected) {
        return;
    }

    coin.collected = true;

    let points = isBoosterActive(now) ? settings.boostedCoinPoints : settings.coinPoints;
    if (isDoubleCoinActive(now) || isFeverActive(now)) points *= 2;

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const comboBonus = combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
    addScore(points + comboBonus);
    emitParticles(coin.x + coin.width/2, coin.y + coin.height/2, 14, {color:"255,220,70", speedMax:4});

    if (!isBoosterActive(now)) {
        coinFaceEndTime =
            now +
            settings.coinFaceDuration;
    }
}

/*
=========================================================
BOOSTER
=========================================================
*/

function spawnBooster(obstacle, safeY) {
    const typeRoll = Math.random();
    const type = typeRoll < 0.34 ? "speed" : typeRoll < 0.67 ? "shield" : "slow";
    boosters.push({
        type,
        x: obstacle.x - 170,

        y:
            clamp(
                safeY,
                settings.boosterSize / 2 + 20,
                GAME_HEIGHT -
                settings.boosterSize / 2 -
                20
            ) -
            settings.boosterSize / 2,

        width: settings.boosterSize,
        height: settings.boosterSize,

        collected: false,

        animationOffset:
            Math.random() *
            Math.PI *
            2
    });
}

function collectBooster(booster, now) {
    if (booster.collected) {
        return;
    }

    booster.collected = true;
    tone(900, 0.16, "square", 0.045);
    vibrate([15, 15, 20]);

    if (booster.type === "shield") {
        shieldCharges = Math.min(2, shieldCharges + 1);
        emitParticles(booster.x+30, booster.y+30, 24, {color:"80,220,255", speedMax:4.5});
        updateEnhancementHud();
        return;
    }
    if (booster.type === "slow") {
        slowEndTime = Math.max(now, slowEndTime) + 5000;
        emitParticles(booster.x+30, booster.y+30, 24, {color:"170,130,255", speedMax:4.5});
        updateEnhancementHud();
        return;
    }

    // Przyspieszenie anuluje aktywne spowolnienie, aby efekty się nie gryzły.
    slowEndTime = 0;

    if (isBoosterActive(now)) {
        boosterEndTime +=
            settings.boosterDuration;
    } else {
        boosterEndTime =
            now +
            settings.boosterDuration;
    }

    updateBoosterDisplay(now);
    updateEnhancementHud(now);
}

/*
=========================================================
PUNKTACJA
=========================================================
*/

function addScore(points) {
    score += points;
    tone(points > 1 ? 760 : 660, 0.07, "triangle", 0.04);

    checkBoosterThreshold();
    checkGlowStage();
    checkRandomEvent();
    updateScoreDisplays();
    updateEnhancementHud();
}

function checkBoosterThreshold() {
    if (score < nextBoosterScore) {
        return;
    }

    pendingBooster = true;

    nextBoosterScore += randomInteger(
        settings.boosterIntervalMin,
        settings.boosterIntervalMax
    );
}

function updateScoreDisplays() {
    if (scoreDisplay) {
        scoreDisplay.textContent =
            String(score);
    }

    if (bestScoreDisplay) {
        bestScoreDisplay.textContent =
            String(bestScore);
    }
}


/* =========================================================
   LOSOWE PRZEDMIOTY, WYDARZENIA I FEVER
========================================================= */
function showEventBanner(title, subtitle = "") {
    const banner = document.getElementById("eventBanner");
    if (!banner) return;
    banner.querySelector("strong").textContent = title;
    banner.querySelector("span").textContent = subtitle;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
}

function spawnMysteryItem(obstacle, safeY) {
    mysteryItems.push({x: obstacle.x - 118, y: clamp(safeY-36, 48, GAME_HEIGHT-120), width:72, height:72, collected:false, phase:Math.random()*6.28});
}
function spawnRareItem(obstacle, safeY) {
    const type = Math.random() < .72 ? "diamond" : "heart";
    rareItems.push({type, x: obstacle.x - 225, y: clamp(safeY-28, 48, GAME_HEIGHT-105), width:56, height:56, collected:false, phase:Math.random()*6.28});
}
function applyMysteryReward(now, item) {
    const rewards = ["shield","slow","speed","magnet","double","life","jackpot"];
    const reward = chooseRandom(rewards);
    const names = {shield:"🛡️ TARCZA",slow:"❄️ SPOWOLNIENIE",speed:"⚡ TURBO",magnet:"🧲 MAGNES",double:"🪙 MONETY ×2",life:"❤️ DRUGA SZANSA",jackpot:"💎 JACKPOT +15"};
    if (reward === "shield") shieldCharges = Math.min(2, shieldCharges + 1);
    if (reward === "slow") slowEndTime = now + 5000;
    if (reward === "speed") { slowEndTime = 0; boosterEndTime = now + settings.boosterDuration; }
    if (reward === "magnet") magnetEndTime = now + 7000;
    if (reward === "double") doubleCoinEndTime = now + 8000;
    if (reward === "life") extraLives = Math.min(1, extraLives + 1);
    if (reward === "jackpot") addScore(15);
    showEventBanner(names[reward], "Nagroda ze skrzynki");
    tone(1120,.22,"triangle",.055); vibrate([18,18,28]);
    emitParticles(item.x+26,item.y+26,30,{color:"255,215,70",speedMax:5.5,sizeMax:8});
}
function updateSpecialItems(frameScale, now) {
    const speed = getCurrentWorldSpeed(now)*frameScale;
    const box = getPlayerCollisionBox();
    for (const item of mysteryItems) {
        item.x -= speed;
        if (!item.collected && rectanglesOverlap(box,item)) { item.collected=true; applyMysteryReward(now,item); }
    }
    for (const item of rareItems) {
        item.x -= speed;
        if (!item.collected && rectanglesOverlap(box,item)) {
            item.collected=true;
            if(item.type==="diamond"){ addScore(10); showEventBanner("💎 DIAMENT +10","Rzadkie znalezisko"); }
            else { extraLives=Math.min(1,extraLives+1); showEventBanner("❤️ DRUGA SZANSA","Chroni przed przegraną"); }
            tone(1040,.2,"sine",.055); emitParticles(item.x+22,item.y+22,26,{color:item.type==="diamond"?"80,230,255":"255,80,130",speedMax:5});
        }
    }
    if (isMagnetActive(now)) {
        for (const coin of coins) {
            const dx=(player.x+32)-(coin.x+coin.width/2), dy=(player.y+32)-(coin.y+coin.height/2), d=Math.hypot(dx,dy);
            if(d<250 && d>1){ coin.x += dx/d*5*frameScale; coin.y += dy/d*5*frameScale; }
        }
    }
    mysteryItems=mysteryItems.filter(i=>!i.collected&&i.x+i.width>-80);
    rareItems=rareItems.filter(i=>!i.collected&&i.x+i.width>-80);
}
function drawDiamond(item, now) {
    const bob = Math.sin(now / 190 + item.phase) * 6;
    const pulse = 1 + Math.sin(now / 130 + item.phase) * 0.055;
    ctx.save();
    ctx.translate(item.x + item.width / 2, item.y + item.height / 2 + bob);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.sin(now / 520 + item.phase) * 0.08);

    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 38);
    aura.addColorStop(0, "rgba(255,255,255,.9)");
    aura.addColorStop(.25, "rgba(80,235,255,.42)");
    aura.addColorStop(1, "rgba(40,130,255,0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = "#50eaff";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.moveTo(0, -27); ctx.lineTo(23, -9); ctx.lineTo(16, 18);
    ctx.lineTo(0, 30); ctx.lineTo(-16, 18); ctx.lineTo(-23, -9); ctx.closePath();
    const gem = ctx.createLinearGradient(-18, -24, 18, 28);
    gem.addColorStop(0, "#f8ffff"); gem.addColorStop(.22, "#6ff7ff");
    gem.addColorStop(.58, "#159ee8"); gem.addColorStop(1, "#2749c7");
    ctx.fillStyle = gem; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(235,255,255,.95)"; ctx.lineWidth = 2; ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.68)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0,-27); ctx.lineTo(0,30);
    ctx.moveTo(-23,-9); ctx.lineTo(23,-9);
    ctx.moveTo(-23,-9); ctx.lineTo(0,8); ctx.lineTo(23,-9);
    ctx.moveTo(-16,18); ctx.lineTo(0,8); ctx.lineTo(16,18);
    ctx.stroke();

    for (let i=0;i<4;i++) {
        const a = now/420 + item.phase + i*Math.PI/2;
        const r = 34 + 3*Math.sin(now/180+i);
        const x = Math.cos(a)*r, y = Math.sin(a)*r;
        ctx.fillStyle = `rgba(255,255,255,${.45+.35*Math.sin(now/110+i)})`;
        ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

function drawSpecialItems(now) {
    for (const item of mysteryItems) {
        const bob = Math.sin(now / 210 + item.phase) * 6;
        const pulse = 1 + Math.sin(now / 150 + item.phase) * .035;
        ctx.save();
        ctx.translate(item.x + item.width/2, item.y + item.height/2 + bob);
        ctx.scale(pulse,pulse);
        ctx.rotate(Math.sin(now / 420 + item.phase) * .055);
        ctx.shadowColor = "#ffb31a";
        ctx.shadowBlur = 24;
        if (imageReady(images.slotPickup)) {
            ctx.drawImage(images.slotPickup, -item.width/2, -item.height/2, item.width, item.height);
        } else {
            ctx.fillStyle="#ff9b19"; ctx.fillRect(-32,-32,64,64);
        }
        ctx.restore();
    }
    for (const item of rareItems) {
        if (item.type === "diamond") drawDiamond(item, now);
        else {
            const bob=Math.sin(now/180+item.phase)*6;
            ctx.save();ctx.translate(item.x+item.width/2,item.y+item.height/2+bob);
            ctx.shadowBlur=24;ctx.shadowColor="#ff4f85";ctx.font="46px system-ui";
            ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("❤️",0,0);ctx.restore();
        }
    }
}
function activateFever(now){ fever=0; feverEndTime=now+9000; doubleCoinEndTime=Math.max(doubleCoinEndTime,feverEndTime); showEventBanner("🔥 FEVER MODE","Podwójne monety i więcej energii!");tone(1280,.3,"sawtooth",.05);emitParticles(player.x+32,player.y+32,45,{color:"255,110,40",speedMax:7,sizeMax:9}); }
function checkRandomEvent(){
    if(score < nextEventScore || activeEvent) return;
    nextEventScore = score + randomInteger(22,34);
    activeEvent = chooseRandom(["rain","snow","wind","night","storm"]);
    eventEndTime = performance.now() + randomInteger(9000,14000);
    nextLightningTime = performance.now() + randomInteger(1200,2400);
    windGust = 0;
    const labels={
        rain:["🌧️ ULEWA","Cięższe opadanie — skacz odrobinę wcześniej"],
        snow:["❄️ ZAMIEĆ","Świat zwalnia, ale sterowanie jest bardziej miękkie"],
        wind:["🌬️ SILNY WIATR","Podmuchy zmieniają tor lotu"],
        night:["🌙 NOC","Widoczność jest mniejsza, monety świecą mocniej"],
        storm:["⛈️ BURZA","Błyskawice wywołują krótkie wstrząsy"]
    };
    showEventBanner(...labels[activeEvent]);
}

function updateWorldEvent(frameScale,now){
    if(activeEvent && now>=eventEndTime){
        activeEvent=null; weatherParticles=[]; ambientEventParticles=[];
        lightningFlash=0; windGust=0;
        showEventBanner("☀️ POGODA MIJA","Warunki wróciły do normy");
    }
    lightningFlash = Math.max(0, lightningFlash - .055*frameScale);
    if(!activeEvent) return;

    if(activeEvent==="wind"){
        windGust = Math.sin(now/520) * .055 + Math.sin(now/1730) * .03;
        player.velocityY += windGust * frameScale;
    }
    if(activeEvent==="storm" && now >= nextLightningTime){
        nextLightningTime = now + randomInteger(1600,3100);
        lightningFlash = 1;
        screenShake = Math.max(screenShake, 2.8);
        player.velocityY += randomBetween(-.28,.34);
        tone(90,.12,"sawtooth",.025);
    }

    const count = activeEvent==="storm"?5:activeEvent==="rain"?7:activeEvent==="snow"?3:activeEvent==="wind"?2:1;
    for(let i=0;i<count;i++){
        if(weatherParticles.length>=190) break;
        if(activeEvent==="snow") weatherParticles.push({x:Math.random()*GAME_WIDTH,y:-20,vx:randomBetween(-.8,.25),vy:randomBetween(.7,1.5),size:randomBetween(2,5),phase:Math.random()*6.28});
        else if(activeEvent==="wind") weatherParticles.push({x:GAME_WIDTH+20,y:Math.random()*GAME_HEIGHT,vx:randomBetween(-8,-4),vy:randomBetween(-.35,.35),size:randomBetween(18,55),phase:0});
        else if(activeEvent!=="night") weatherParticles.push({x:Math.random()*(GAME_WIDTH+120),y:-20,vx:activeEvent==="storm"?randomBetween(-2.7,-1.7):randomBetween(-1.8,-1),vy:activeEvent==="storm"?randomBetween(10,15):randomBetween(8,12),size:randomBetween(1,2.4),phase:0});
    }
    for(const p of weatherParticles){
        if(activeEvent==="snow") p.x += (p.vx + Math.sin(now/400+p.phase)*.45)*frameScale;
        else p.x += p.vx*frameScale;
        p.y += p.vy*frameScale;
    }
    weatherParticles=weatherParticles.filter(p=>p.y<GAME_HEIGHT+45&&p.x>-90&&p.x<GAME_WIDTH+90);
}

function drawWorldEvent(now){
    ctx.save();
    if(activeEvent==="night"){
        const night=ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
        night.addColorStop(0,"rgba(4,8,35,.72)"); night.addColorStop(1,"rgba(10,25,60,.46)");
        ctx.fillStyle=night;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        for(let i=0;i<55;i++){
            const tw=.35+.45*Math.sin(now/520+i*1.7);
            ctx.fillStyle=`rgba(235,245,255,${tw})`;
            ctx.beginPath();ctx.arc((i*137)%GAME_WIDTH,(i*73)%310,1+(i%3)*.35,0,Math.PI*2);ctx.fill();
        }
        const moon=ctx.createRadialGradient(820,90,4,820,90,48);
        moon.addColorStop(0,"rgba(255,255,230,.95)");moon.addColorStop(.35,"rgba(210,230,255,.36)");moon.addColorStop(1,"rgba(130,170,255,0)");
        ctx.fillStyle=moon;ctx.beginPath();ctx.arc(820,90,48,0,Math.PI*2);ctx.fill();
    }
    if(activeEvent==="rain" || activeEvent==="storm"){
        const haze=ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
        haze.addColorStop(0,activeEvent==="storm"?"rgba(20,30,60,.30)":"rgba(60,100,135,.14)");
        haze.addColorStop(1,"rgba(20,45,70,.12)");ctx.fillStyle=haze;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    }
    if(activeEvent==="snow"){
        ctx.fillStyle="rgba(220,245,255,.10)";ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    }

    for(const p of weatherParticles){
        if(activeEvent==="snow"){
            ctx.fillStyle="rgba(255,255,255,.9)";ctx.shadowColor="#dff8ff";ctx.shadowBlur=5;
            ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
        } else if(activeEvent==="wind"){
            const grad=ctx.createLinearGradient(p.x,p.y,p.x+p.size,p.y);
            grad.addColorStop(0,"rgba(255,255,255,0)");grad.addColorStop(1,"rgba(235,250,255,.42)");
            ctx.strokeStyle=grad;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+p.size*.55,p.y-5,p.x+p.size,p.y);ctx.stroke();
        } else {
            ctx.strokeStyle=activeEvent==="storm"?"rgba(195,220,255,.72)":"rgba(220,245,255,.58)";
            ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-7,p.y-24);ctx.stroke();
        }
    }
    ctx.shadowBlur=0;
    if(activeEvent==="storm" && lightningFlash>0){
        ctx.fillStyle=`rgba(235,245,255,${lightningFlash*.42})`;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        ctx.strokeStyle=`rgba(255,255,255,${lightningFlash})`;ctx.lineWidth=3;
        const x=690;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-28,86);ctx.lineTo(x+4,82);ctx.lineTo(x-38,170);ctx.stroke();
    }
    if(activeEvent==="wind"){
        const side=ctx.createLinearGradient(0,0,210,0);side.addColorStop(0,"rgba(160,225,255,.13)");side.addColorStop(1,"rgba(160,225,255,0)");ctx.fillStyle=side;ctx.fillRect(0,0,230,GAME_HEIGHT);
    }
    if(isFeverActive(now)){ctx.fillStyle=`rgba(255,70,15,${.08+.04*Math.sin(now/100)})`;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);}
    ctx.restore();
}

/*
=========================================================
HITBOX GRACZA
=========================================================
*/

function getPlayerCollisionBox() {
    return {
        x:
            player.x +
            player.collisionPaddingX,

        y:
            player.y +
            player.collisionPaddingY,

        width:
            player.width -
            player.collisionPaddingX * 2,

        height:
            player.height -
            player.collisionPaddingY * 2
    };
}

/*
=========================================================
HITBOXY PRZESZKÓD
=========================================================
*/

/*
Hitboxy są zapisane jako wartości procentowe.

Dzięki temu automatycznie reagują na zmianę:

obstacleWidth
obstacleDrawHeight
*/

const bottomObstacleHitboxes = [
    /*
    Grafika dolnej przeszkody ma duży przezroczysty
    fragment u góry. Poprzednie hitboxy wchodziły w ten
    niewidoczny obszar, przez co gracz przegrywał jeszcze
    przed dotknięciem puszki.

    Poniższe pasy obejmują wyłącznie faktycznie widoczną
    część grafiki (z małym marginesem bezpieczeństwa).
    */
    { x: 0.095, y: 0.3875, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.4900, width: 0.810, height: 0.1017 },
    { x: 0.095, y: 0.5917, width: 0.810, height: 0.1017 },
    { x: 0.095, y: 0.6933, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.7958, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.8983, width: 0.810, height: 0.1017 }
];

/*
Górna przeszkoda korzysta z osobnej grafiki i podczas
rysowania jest odwracana pionowo. Dlatego ma własne,
odwrócone hitboxy zamiast kopii hitboxów dolnej puszki.
*/
const topObstacleHitboxes = [
    { x: 0.120, y: 0.5091, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.4075, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.3058, width: 0.7500, height: 0.1025 },
    { x: 0.120, y: 0.2033, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.1016, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.0000, width: 0.7475, height: 0.1017 }
];

function createScaledHitboxes(
    obstacle,
    templates,
    drawY,
    drawHeight
) {
    return templates.map(template => ({
        x:
            obstacle.x +
            template.x *
            obstacle.width,

        y:
            drawY +
            template.y *
            drawHeight,

        width:
            template.width *
            obstacle.width,

        height:
            template.height *
            drawHeight
    }));
}

function getObstacleCollisionBoxes(obstacle) {
    const boxes = [];

    /*
    Górna grafika kończy się na pozycji topVisible.
    */

    if (obstacle.topVisible > 0) {
        const topDrawY =
            obstacle.topVisible -
            settings.obstacleDrawHeight;

        boxes.push(
            ...createScaledHitboxes(
                obstacle,
                topObstacleHitboxes,
                topDrawY,
                settings.obstacleDrawHeight
            )
        );
    }

    /*
    Dolna grafika zaczyna się na pozycji:
    GAME_HEIGHT - bottomVisible.
    */

    if (obstacle.bottomVisible > 0) {
        const bottomDrawY =
            GAME_HEIGHT -
            obstacle.bottomVisible;

        boxes.push(
            ...createScaledHitboxes(
                obstacle,
                bottomObstacleHitboxes,
                bottomDrawY,
                settings.obstacleDrawHeight
            )
        );
    }

    /*
    Przycinanie hitboxów do obszaru canvas.
    */

    return boxes
        .filter(box => {
            return (
                box.y < GAME_HEIGHT &&
                box.y + box.height > 0
            );
        })
        .map(box => {
            const clippedTop =
                Math.max(0, box.y);

            const clippedBottom =
                Math.min(
                    GAME_HEIGHT,
                    box.y + box.height
                );

            return {
                x: box.x,
                y: clippedTop,
                width: box.width,
                height:
                    clippedBottom -
                    clippedTop
            };
        })
        .filter(box => {
            return (
                box.width > 0 &&
                box.height > 0
            );
        });
}

function checkObstacleCollisions() {
    const playerBox =
        getPlayerCollisionBox();

    for (const obstacle of obstacles) {
        const boxes =
            getObstacleCollisionBoxes(
                obstacle
            );

        for (const box of boxes) {
            if (
                rectanglesOverlap(
                    playerBox,
                    box
                )
            ) {
                endGame();
                return;
            }
        }
    }
}
/*
=========================================================
AKTUALIZACJA GRACZA
=========================================================
*/

function updatePlayer(frameScale) {
    let gravityMultiplier = 1;
    if (activeEvent === "rain") gravityMultiplier = 1.16;
    if (activeEvent === "snow") gravityMultiplier = 0.88;
    player.velocityY +=
        settings.gravity * gravityMultiplier *
        frameScale;

    if (
        player.velocityY >
        settings.maxFallSpeed
    ) {
        player.velocityY =
            settings.maxFallSpeed;
    }

    player.y +=
        player.velocityY *
        frameScale;

    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }

    if (
        player.y +
        player.height >=
        GAME_HEIGHT
    ) {
        player.y =
            GAME_HEIGHT -
            player.height;

        endGame();
    }
}

/*
=========================================================
AKTUALIZACJA PRZESZKÓD
=========================================================
*/

function updateObstacles(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    for (const obstacle of obstacles) {
        obstacle.x -= speed;

        if (
            !obstacle.passed &&
            obstacle.x +
            obstacle.width <
            player.x
        ) {
            obstacle.passed = true;
            const gapTop = obstacle.topVisible || 0;
            const gapBottom = obstacle.bottomVisible ? GAME_HEIGHT - obstacle.bottomVisible : GAME_HEIGHT;
            const gapCenter = (gapTop + gapBottom) / 2;
            const playerCenter = player.y + player.height / 2;
            const perfect = Math.abs(playerCenter - gapCenter) < 34;
            if (perfect) {
                combo += 1;
                fever = Math.min(100, fever + 9);
                maxCombo = Math.max(maxCombo, combo);
                addScore(settings.obstaclePoints + (combo >= 6 ? 1 : 0) + (obstacle.special === "gold" ? 2 : 0));
                tone(980, .08, "triangle", .045);
                emitParticles(player.x+50, playerCenter, 12, {color:"255,255,255", driftX:-1.5});
            } else {
                combo = Math.max(0, combo - 1);
                fever = Math.max(0, fever - 5);
                addScore(settings.obstaclePoints + (obstacle.special === "gold" ? 2 : 0));
            }
            if (fever >= 100 && !isFeverActive(now)) activateFever(now);
            updateEnhancementHud();
        }
    }

    obstacles = obstacles.filter(
        obstacle =>
            obstacle.x +
            obstacle.width >
            -100
    );

    const lastObstacle =
        obstacles[
            obstacles.length - 1
        ];

    if (!lastObstacle) {
        spawnObstacle(
            GAME_WIDTH + 100
        );

        return;
    }

    if (
        lastObstacle.x <
        GAME_WIDTH -
        lastObstacle.spacingAfter
    ) {
        spawnObstacle(
            GAME_WIDTH + 100
        );
    }
}

/*
=========================================================
AKTUALIZACJA MONET
=========================================================
*/

function updateCoins(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    const playerBox =
        getPlayerCollisionBox();

    for (const coin of coins) {
        coin.x -= speed;

        if (
            !coin.collected &&
            rectanglesOverlap(
                playerBox,
                coin
            )
        ) {
            collectCoin(
                coin,
                now
            );
        }
    }

    coins = coins.filter(
        coin =>
            !coin.collected &&
            coin.x +
            coin.width >
            -60
    );
}

/*
=========================================================
AKTUALIZACJA BOOSTERÓW
=========================================================
*/

function updateBoosters(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    const playerBox =
        getPlayerCollisionBox();

    for (const booster of boosters) {
        booster.x -= speed;

        if (
            !booster.collected &&
            rectanglesOverlap(
                playerBox,
                booster
            )
        ) {
            collectBooster(
                booster,
                now
            );
        }
    }

    boosters = boosters.filter(
        booster =>
            !booster.collected &&
            booster.x +
            booster.width >
            -80
    );
}

/*
=========================================================
ZMIANA KOLORU TŁA
=========================================================
*/

function checkGlowStage() {
    const newStage = Math.floor(
        score /
        settings.glowEveryPoints
    );

    if (newStage === currentGlowStage) {
        return;
    }

    previousGlowColor =
        getInterpolatedGlowColor(
            performance.now()
        );

    currentGlowStage = newStage;

    targetGlowColor =
        glowColors[
            newStage %
            glowColors.length
        ];

    glowTransitionStart =
        performance.now();
}

function getInterpolatedGlowColor(now) {
    const progress = clamp(
        (
            now -
            glowTransitionStart
        ) /
        settings.glowTransitionDuration,
        0,
        1
    );

    const smoothProgress =
        progress *
        progress *
        (3 - 2 * progress);

    return {
        r:
            previousGlowColor.r +
            (
                targetGlowColor.r -
                previousGlowColor.r
            ) *
            smoothProgress,

        g:
            previousGlowColor.g +
            (
                targetGlowColor.g -
                previousGlowColor.g
            ) *
            smoothProgress,

        b:
            previousGlowColor.b +
            (
                targetGlowColor.b -
                previousGlowColor.b
            ) *
            smoothProgress
    };
}

/*
=========================================================
RYSOWANIE TŁA
=========================================================
*/

function drawBackground(now) {
    if (imageReady(images.background)) {
        ctx.drawImage(
            images.background,
            0,
            0,
            GAME_WIDTH,
            GAME_HEIGHT
        );
    } else {
        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                GAME_HEIGHT
            );

        gradient.addColorStop(
            0,
            "#72c7e8"
        );

        gradient.addColorStop(
            1,
            "#d8f3ff"
        );

        ctx.fillStyle = gradient;

        ctx.fillRect(
            0,
            0,
            GAME_WIDTH,
            GAME_HEIGHT
        );
    }

    if (currentGlowStage <= 0) {
        return;
    }

    const glow =
        getInterpolatedGlowColor(now);

    const pulse =
        settings.glowOverlayOpacity +
        Math.sin(now / 500) *
        0.045;

    ctx.save();

    ctx.fillStyle =
        `rgba(` +
        `${Math.round(glow.r)},` +
        `${Math.round(glow.g)},` +
        `${Math.round(glow.b)},` +
        `${pulse})`;

    ctx.fillRect(
        0,
        0,
        GAME_WIDTH,
        GAME_HEIGHT
    );

    const radial =
        ctx.createRadialGradient(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            50,

            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH * 0.75
        );

    radial.addColorStop(
        0,
        `rgba(
            ${Math.round(glow.r)},
            ${Math.round(glow.g)},
            ${Math.round(glow.b)},
            0.03
        )`
    );

    radial.addColorStop(
        1,
        `rgba(
            ${Math.round(glow.r)},
            ${Math.round(glow.g)},
            ${Math.round(glow.b)},
            0.58
        )`
    );

    ctx.fillStyle = radial;

    ctx.fillRect(
        0,
        0,
        GAME_WIDTH,
        GAME_HEIGHT
    );

    ctx.restore();
}

function drawAtmosphere(now) {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "rgba(255,255,255,0.08)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(0,20,55,0.16)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (isBoosterActive(now) && settings.particlesEnabled) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 14; i += 1) {
            const y = (i * 47 + now * 0.24) % GAME_HEIGHT;
            const x = (i * 83 + now * 0.58) % (GAME_WIDTH + 180) - 180;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 75, y);
            ctx.stroke();
        }
        ctx.restore();
    }
}

/*
=========================================================
RYSOWANIE PRZESZKÓD
=========================================================
*/

function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.save();
        if (obstacle.special === "gold") { ctx.filter = "sepia(1) saturate(2.5) hue-rotate(345deg) brightness(1.12)"; ctx.shadowColor="#ffd43b"; ctx.shadowBlur=12; }
        if (obstacle.special === "pulse") { ctx.globalAlpha=.82+.18*Math.sin(performance.now()/160+obstacle.pulsePhase); ctx.shadowColor="#65e7ff";ctx.shadowBlur=18; }
        /*
        GÓRNA PRZESZKODA

        Dolna krawędź grafiki kończy się dokładnie
        na obstacle.topVisible.

        Reszta grafiki znajduje się ponad ekranem.
        */

        if (
            obstacle.topVisible > 0 &&
            imageReady(images.obstacleTop)
        ) {
            ctx.save();

            ctx.translate(
                obstacle.x,
                obstacle.topVisible
            );

            ctx.scale(1, -1);

            ctx.drawImage(
                images.obstacleTop,
                0,
                0,
                obstacle.width,
                settings.obstacleDrawHeight
            );

            ctx.restore();
        }

        /*
        DOLNA PRZESZKODA

        Górna krawędź grafiki zaczyna się na pozycji:
        GAME_HEIGHT - obstacle.bottomVisible.

        Pozostała część grafiki znajduje się pod ekranem.
        */

        if (
            obstacle.bottomVisible > 0 &&
            imageReady(images.obstacleBottom)
        ) {
            const bottomDrawY =
                GAME_HEIGHT -
                obstacle.bottomVisible;

            ctx.drawImage(
                images.obstacleBottom,
                obstacle.x,
                bottomDrawY,
                obstacle.width,
                settings.obstacleDrawHeight
            );
        }
        ctx.restore();
    }
}

/*
=========================================================
RYSOWANIE MONET
=========================================================
*/

function drawCoins(now) {
    for (const coin of coins) {
        const floatingOffset =
            Math.sin(
                now / 280 +
                coin.animationOffset
            ) *
            4;

        const rotationScale =
            0.78 +
            Math.abs(
                Math.sin(
                    now / 320 +
                    coin.animationOffset
                )
            ) *
            0.22;

        const drawWidth =
            coin.width *
            rotationScale;

        const drawX =
            coin.x +
            (
                coin.width -
                drawWidth
            ) /
            2;

        const drawY =
            coin.y +
            floatingOffset;

        ctx.save();

        ctx.shadowBlur = 17;
        ctx.shadowColor =
            "rgba(255, 211, 61, 0.9)";

        if (imageReady(images.coin)) {
            ctx.drawImage(
                images.coin,
                drawX,
                drawY,
                drawWidth,
                coin.height
            );
        }

        ctx.restore();
    }
}

/*
=========================================================
RYSOWANIE BOOSTERÓW
=========================================================
*/

function drawBoosters(now) {
    for (const booster of boosters) {
        const pulse =
            1 +
            Math.sin(
                now / 170 +
                booster.animationOffset
            ) *
            0.09;

        const width =
            booster.width *
            pulse;

        const height =
            booster.height *
            pulse;

        const drawX =
            booster.x +
            (
                booster.width -
                width
            ) /
            2;

        const drawY =
            booster.y +
            (
                booster.height -
                height
            ) /
            2;

        ctx.save();

        ctx.shadowBlur = 26;
        ctx.shadowColor =
            "rgba(255, 45, 45, 0.95)";

        if (imageReady(images.booster)) {
            ctx.drawImage(
                images.booster,
                drawX,
                drawY,
                width,
                height
            );
        }

        ctx.restore();
    }
}

/*
=========================================================
WYBÓR GRAFIKI GRACZA
=========================================================
*/

function getCurrentPlayerImage(now) {
    if (isBoosterActive(now)) {
        return images.playerBooster;
    }

    if (now < coinFaceEndTime) {
        return images.playerCoin;
    }

    return images.player;
}

/*
=========================================================
RYSOWANIE GRACZA
=========================================================
*/

function drawPlayer(now) {
    const image =
        getCurrentPlayerImage(now);

    if (!imageReady(image)) {
        return;
    }

    const centerX =
        player.x +
        player.width / 2;

    const centerY =
        player.y +
        player.height / 2;

    const rotation = clamp(
        player.velocityY * 0.1,
        -0.25,
        0.35
    );

    ctx.save();

    ctx.translate(
        centerX,
        centerY
    );

    ctx.rotate(rotation);

    if (isBoosterActive(now)) {
        const boosterPulse =
            1 +
            Math.sin(now / 100) *
            0.025;

        ctx.scale(
            boosterPulse,
            boosterPulse
        );

        ctx.shadowBlur = 28;
        ctx.shadowColor =
            "rgba(255, 35, 35, 0.95)";
    }

    ctx.drawImage(
        image,
        -player.width / 2,
        -player.height / 2,
        player.width,
        player.height
    );

    ctx.restore();
}

/*
=========================================================
RYSOWANIE WYNIKU
=========================================================
*/

function drawGameScore() {
    const x = GAME_WIDTH - 28;
    const y = 22;

    ctx.save();

    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    ctx.font = "bold 42px Arial";
    ctx.lineWidth = 7;

    ctx.strokeStyle =
        "rgba(0, 0, 0, 0.72)";

    ctx.strokeText(
        String(score),
        x,
        y
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
        String(score),
        x,
        y
    );

    ctx.restore();
}
/*
=========================================================
HUD AKTYWNEGO BOOSTERA
=========================================================
*/

function drawActiveBoosterHud(now) {
    if (!isBoosterActive(now)) {
        return;
    }

    const remaining =
        Math.max(
            0,
            boosterEndTime - now
        );

    const seconds =
        remaining / 1000;

    const barWidth = 190;
    const barHeight = 18;

    const x =
        GAME_WIDTH / 2 -
        barWidth / 2;

    const y = 24;

    const progress = clamp(
        remaining /
        settings.boosterDuration,
        0,
        1
    );

    ctx.save();

    ctx.fillStyle =
        "rgba(0, 0, 0, 0.58)";

    ctx.fillRect(
        x - 10,
        y - 10,
        barWidth + 20,
        58
    );

    ctx.fillStyle =
        "rgba(255, 255, 255, 0.22)";

    ctx.fillRect(
        x,
        y + 24,
        barWidth,
        barHeight
    );

    ctx.fillStyle =
        "rgba(255, 48, 48, 0.95)";

    ctx.fillRect(
        x,
        y + 24,
        barWidth * progress,
        barHeight
    );

    ctx.strokeStyle =
        "rgba(255, 255, 255, 0.9)";

    ctx.lineWidth = 2;

    ctx.strokeRect(
        x,
        y + 24,
        barWidth,
        barHeight
    );

    ctx.fillStyle = "#ffffff";

    ctx.font =
        "bold 18px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillText(
        `BOOSTER ${seconds.toFixed(1)} s`,
        GAME_WIDTH / 2,
        y
    );

    ctx.restore();
}

/*
=========================================================
AKTUALIZACJA NAPISU BOOSTERA W HTML
=========================================================
*/

function updateBoosterDisplay(
    now = performance.now()
) {
    if (!boosterStatus) {
        return;
    }

    const timeElement = boosterStatus.querySelector(".booster-time");

    if (!isBoosterActive(now)) {
        if (timeElement) {
            timeElement.textContent = "nieaktywny";
        }

        boosterStatus.style.setProperty(
            "--booster-progress",
            "0%"
        );

        boosterStatus.classList.remove(
            "active"
        );

        return;
    }

    const remaining =
        Math.max(
            0,
            boosterEndTime - now
        );

    const progress = clamp(
        remaining / settings.boosterDuration,
        0,
        1
    );

    if (timeElement) {
        timeElement.textContent =
            `${(remaining / 1000).toFixed(1)} s`;
    }

    boosterStatus.style.setProperty(
        "--booster-progress",
        `${progress * 100}%`
    );

    boosterStatus.classList.add(
        "active"
    );
}

/*
=========================================================
TRYB DEBUGOWANIA HITBOXÓW
=========================================================
*/

function drawDebugHitboxes() {
    if (!DEBUG_HITBOXES) {
        return;
    }

    ctx.save();

    const playerBox =
        getPlayerCollisionBox();

    ctx.strokeStyle =
        "rgba(0, 255, 0, 0.95)";

    ctx.lineWidth = 2;

    ctx.strokeRect(
        playerBox.x,
        playerBox.y,
        playerBox.width,
        playerBox.height
    );

    ctx.strokeStyle =
        "rgba(255, 0, 0, 0.95)";

    for (const obstacle of obstacles) {
        const boxes =
            getObstacleCollisionBoxes(
                obstacle
            );

        for (const box of boxes) {
            ctx.strokeRect(
                box.x,
                box.y,
                box.width,
                box.height
            );
        }
    }

    ctx.restore();
}

/*
=========================================================
AKTUALIZACJA GRY
=========================================================
*/

function updateGame(
    frameScale,
    now,
    deltaTime
) {
    updateParticles(frameScale, deltaTime);
    screenShake = Math.max(0, screenShake - 0.7 * frameScale);

    if (
        gameState !==
        GAME_STATE.RUNNING
    ) {
        updateBoosterDisplay(now);
    updateEnhancementHud(now);
        return;
    }

    updatePlayer(frameScale);
    updateObstacles(
        frameScale,
        now
    );

    updateCoins(
        frameScale,
        now
    );

    updateBoosters(
        frameScale,
        now
    );
    updateSpecialItems(frameScale, now);
    updateWorldEvent(frameScale, now);

    checkObstacleCollisions();
    updateBoosterDisplay(now);
    updateEnhancementHud(now);
}

/*
=========================================================
RYSOWANIE CAŁEJ GRY
=========================================================
*/

function drawGame(now) {
    // Czyścimy cały fizyczny bufor bez transformacji, a następnie wracamy
    // do układu współrzędnych świata gry.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyGameTransform();

    ctx.save();
    if (screenShake > 0 && settings.particlesEnabled) {
        ctx.translate(
            randomBetween(-screenShake, screenShake),
            randomBetween(-screenShake, screenShake)
        );
    }

    drawBackground(now);
    drawAtmosphere(now);
    drawWorldEvent(now);
    drawObstacles();
    drawCoins(now);
    drawBoosters(now);
    drawSpecialItems(now);
    drawParticles();
    drawPlayer(now);
    drawDebugHitboxes();
    ctx.restore();
}

/*
=========================================================
PĘTLA GRY
=========================================================
*/

function gameLoop(now) {
    const deltaTime =
        Math.min(
            40,
            now - lastFrameTime
        );

    lastFrameTime = now;

    const frameScale =
        deltaTime /
        (1000 / 60);

    updateGame(
        frameScale,
        now,
        deltaTime
    );

    drawGame(now);

    requestAnimationFrame(
        gameLoop
    );
}


function updateEnhancementHud(now = performance.now()) {
    if (comboDisplay) comboDisplay.textContent = `Combo x${combo}`;
    if (difficultyDisplay) difficultyDisplay.textContent = isFeverActive(now) ? "🔥 FEVER" : `Poziom ${getDifficultyLevel()}`;
    const feverFill=document.getElementById("feverFill"); if(feverFill) feverFill.style.width=`${isFeverActive(now)?100:fever}%`;
    const lifeBadge=document.getElementById("lifeBadge"); if(lifeBadge){lifeBadge.classList.toggle("active",extraLives>0);lifeBadge.textContent=extraLives>0?"❤️ Drugie życie":"";}
    const magnetBadge=document.getElementById("magnetBadge"); if(magnetBadge){magnetBadge.classList.toggle("active",isMagnetActive(now));magnetBadge.textContent=isMagnetActive(now)?`🧲 ${(Math.max(0,magnetEndTime-now)/1000).toFixed(1)}s`:"";}
    const doubleBadge=document.getElementById("doubleBadge"); if(doubleBadge){doubleBadge.classList.toggle("active",isDoubleCoinActive(now));doubleBadge.textContent=isDoubleCoinActive(now)?`🪙×2 ${(Math.max(0,doubleCoinEndTime-now)/1000).toFixed(1)}s`:"";}

    const speedCard = document.getElementById("speedPowerCard");
    const slowCard = document.getElementById("slowPowerCard");
    const shieldCard = document.getElementById("shieldPowerCard");

    const updateTimedCard = (card, remaining, duration) => {
        if (!card) return;
        const active = remaining > 0;
        card.classList.toggle("active", active);
        card.style.setProperty("--power-progress", `${clamp(remaining / duration, 0, 1) * 100}%`);
        const time = card.querySelector(".power-time");
        if (time) time.textContent = active ? `${(remaining / 1000).toFixed(1)} s` : "";
    };

    updateTimedCard(speedCard, boosterEndTime - now, settings.boosterDuration);
    updateTimedCard(slowCard, slowEndTime - now, 5000);

    if (shieldCard) {
        shieldCard.classList.toggle("active", shieldCharges > 0);
        const count = shieldCard.querySelector(".power-time");
        if (count) count.textContent = shieldCharges > 0 ? `x${shieldCharges}` : "";
        shieldCard.style.setProperty("--power-progress", shieldCharges > 0 ? "100%" : "0%");
    }
}

function togglePause(forcePause = null) {
    if (![GAME_STATE.RUNNING, GAME_STATE.PAUSED].includes(gameState)) return;
    const shouldPause = forcePause === null ? gameState === GAME_STATE.RUNNING : forcePause;
    gameState = shouldPause ? GAME_STATE.PAUSED : GAME_STATE.RUNNING;
    if (pauseScreen) pauseScreen.classList.toggle("hidden", !shouldPause);
    if (pauseButton) pauseButton.textContent = shouldPause ? "▶" : "Ⅱ";
    lastFrameTime = performance.now();
    tone(shouldPause ? 260 : 520, .07, "sine", .035);
}

if (pauseButton) pauseButton.addEventListener("click", e => { e.stopPropagation(); togglePause(); });
if (soundButton) {
    soundButton.textContent = soundEnabled ? "🔊" : "🔇";
    soundButton.addEventListener("click", e => {
        e.stopPropagation(); soundEnabled = !soundEnabled;
        localStorage.setItem("flappySound", soundEnabled ? "on" : "off");
        soundButton.textContent = soundEnabled ? "🔊" : "🔇";
        if (soundEnabled) tone(620, .08, "sine", .04);
    });
}

/*
=========================================================
STEROWANIE
=========================================================
*/

function handlePrimaryInput(event) {
    if (
        event &&
        typeof event.preventDefault ===
            "function"
    ) {
        event.preventDefault();
    }

    if (
        gameState ===
        GAME_STATE.GAME_OVER
    ) {
        return;
    }

    startGame();
}

canvas.addEventListener(
    "pointerdown",
    handlePrimaryInput
);

document.addEventListener(
    "keydown",
    event => {
        if (event.code === "Escape" || event.code === "KeyP") {
            event.preventDefault();
            togglePause();
            return;
        }
        const allowedKeys = [
            "Space",
            "ArrowUp",
            "KeyW"
        ];

        if (
            !allowedKeys.includes(
                event.code
            )
        ) {
            return;
        }

        if (event.repeat) {
            return;
        }

        handlePrimaryInput(event);
    }
);

if (restartButton) {
    restartButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            restartGame();
        }
    );
}

/*
=========================================================
OBSŁUGA UTRATY FOKUSU
=========================================================
*/

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden) {
            if (gameState === GAME_STATE.RUNNING) togglePause(true);
            lastFrameTime = performance.now();
        }
    }
);

window.addEventListener(
    "blur",
    () => {
        lastFrameTime =
            performance.now();
    }
);

let resizeFrame = 0;

function scheduleCanvasResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        configureCanvasQuality();
    });
}

window.addEventListener("resize", scheduleCanvasResize, { passive: true });
window.addEventListener("orientationchange", scheduleCanvasResize, { passive: true });

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleCanvasResize, { passive: true });
}

/*
=========================================================
URUCHOMIENIE
=========================================================
*/

bestScoreDisplay &&
    (
        bestScoreDisplay.textContent =
        String(bestScore)
    );

resetGame();

requestAnimationFrame(
    now => {
        lastFrameTime = now;
        gameLoop(now);
    }
);