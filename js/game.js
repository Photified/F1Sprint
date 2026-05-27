const config = {
    type: Phaser.AUTO,
    width: 1600,
    height: 900,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

const game = new Phaser.Game(config);

let playerCar;
let cpuGroup;
let cursors;

// RACE STATE
let raceStarted = false;
let raceFinished = false;
let startTime = 0;
let laps = 1;
let maxLaps = 3;
let checkpointReached = false;

let lapStartTime = 0;
let bestLapTime = Infinity;
let bestRaceTime = Infinity;

let maskData = null;
let prevX;
let prevY;
let currentSpeed = 0;
let maxSpeed = 450;

let mobileLeft = false;
let mobileRight = false;
let mobileGas = false;
let mobileBrake = false;

// Hidden player waypoint tracking for normal live progress
let playerTargetWP = 2;
let playerTrackProgress = 0;

// AI tuning
const CPU_WAYPOINT_REACH_RADIUS = 40;
const CPU_SHARP_TURN_SLOWDOWN = 0.52;
const CPU_MEDIUM_TURN_SLOWDOWN = 0.70;

// --- AUDIO STATE ---
let audioCtx = null;
let masterGain = null;

let playerEngineOsc = null;
let playerEngineGain = null;
let playerTopOsc = null;
let playerTopGain = null;

let aiEngineOsc = null;
let aiEngineGain = null;

let squealSource = null;
let squealGain = null;
let squealFilter = null;

let audioReady = false;
let soundUnlocked = false;
let soundEnabled = false;

// --- RACING LINE ---
const dayWaypoints = [
    // Bottom straight
    {x: 1375, y: 792},
    {x: 1180, y: 792},
    {x: 980, y: 795},
    {x: 760, y: 805},
    {x: 520, y: 810},
    {x: 300, y: 805},

    // Bottom-left corner
    {x: 205, y: 775},
    {x: 145, y: 725},
    {x: 130, y: 665},
    {x: 155, y: 610},
    {x: 225, y: 575},
    {x: 340, y: 558},
    {x: 475, y: 550},

    // Left-middle inner turn
    {x: 555, y: 535},
    {x: 610, y: 505},
    {x: 625, y: 465},
    {x: 600, y: 430},
    {x: 535, y: 405},
    {x: 440, y: 390},
    {x: 330, y: 380},
    {x: 245, y: 365},

    // Top-left corner
    {x: 175, y: 330},
    {x: 135, y: 280},
    {x: 145, y: 225},
    {x: 195, y: 190},
    {x: 290, y: 175},
    {x: 430, y: 170},

    // Top straight
    {x: 640, y: 168},
    {x: 880, y: 168},
    {x: 1120, y: 170},
    {x: 1325, y: 175},

    // Top-right corner
    {x: 1415, y: 200},
    {x: 1460, y: 255},
    {x: 1455, y: 315},
    {x: 1405, y: 355},
    {x: 1310, y: 370},
    {x: 1190, y: 370},

    // Right inner loop
    {x: 1120, y: 350},
    {x: 1000, y: 350},
    {x: 900, y: 375},

    {x: 860, y: 430},
    {x: 875, y: 500},
    {x: 930, y: 560},

    {x: 1035, y: 585},
    {x: 1165, y: 585},
    {x: 1265, y: 575},

    {x: 1325, y: 565},
    {x: 1405, y: 555},

    // Final corner
    {x: 1465, y: 585},
    {x: 1500, y: 645},
    {x: 1495, y: 710},
    {x: 1445, y: 765},
    {x: 1345, y: 792}
];

const nightWaypoints = [
    // Bottom straight, moving left from the grid / finish line
    {x: 1375, y: 812},
    {x: 1235, y: 812},
    {x: 1090, y: 812},
    {x: 950, y: 812},
    {x: 805, y: 812},
    {x: 650, y: 812},
    {x: 500, y: 812},
    {x: 350, y: 805},
    {x: 230, y: 785},

    // Big bottom-left sweeper
    {x: 165, y: 750},
    {x: 140, y: 685},
    {x: 160, y: 625},
    {x: 235, y: 590},
    {x: 355, y: 590},
    {x: 500, y: 590},
    {x: 610, y: 560},

    // First set of corners, pulled lower from the mask before the back straight
    {x: 665, y: 505},
    {x: 660, y: 440},
    {x: 610, y: 385},
    {x: 520, y: 360},
    {x: 405, y: 362},
    {x: 295, y: 365},
    {x: 215, y: 330},
    {x: 205, y: 285},
    {x: 270, y: 252},

    // Back straight, left to right
    {x: 420, y: 245},
    {x: 600, y: 245},
    {x: 780, y: 245},
    {x: 950, y: 245},
    {x: 1070, y: 250},

    // Wall-forced turn after the back straight
    {x: 1125, y: 278},
    {x: 1120, y: 322},
    {x: 1065, y: 350},
    {x: 980, y: 365},
    {x: 905, y: 405},

    // Center carousel, clockwise around the island
    {x: 875, y: 465},
    {x: 910, y: 525},
    {x: 995, y: 560},
    {x: 1100, y: 560},
    {x: 1210, y: 535},
    {x: 1280, y: 480},
    {x: 1265, y: 415},
    {x: 1200, y: 385},

    // Right-side snake section
    {x: 1225, y: 325},
    {x: 1275, y: 270},
    {x: 1370, y: 245},
    {x: 1460, y: 285},
    {x: 1490, y: 370},
    {x: 1465, y: 470},
    {x: 1415, y: 555},
    {x: 1410, y: 640},

    // Bottom-right bend back to start/finish
    {x: 1470, y: 705},
    {x: 1440, y: 770},
    {x: 1350, y: 812}
];

let waypoints = dayWaypoints;
let currentTrackId = 'day';
let currentTrackName = 'Classic Sprint';
let currentFinishX = 730;
let selectedTrackConfig = null;
let trackBackground = null;

const TRACKS = {
    day: {
        id: 'day',
        name: 'Classic Sprint',
        trackKey: 'trackDay',
        maskKey: 'maskDay',
        waypoints: dayWaypoints,
        finishX: 730,
        playerStart: {x: 1200, y: 813, angle: 180, targetWP: 2},
        cpuStarts: [
            {x: 870, y: 767, color: 'car-blue', speed: 400, laneOffset: -18, startDelay: 0, startingTargetWP: 3},
            {x: 970, y: 767, color: 'car-green', speed: 392, laneOffset: 18, startDelay: 0, startingTargetWP: 3},
            {x: 1070, y: 767, color: 'car-orange', speed: 385, laneOffset: -10, startDelay: 0, startingTargetWP: 2},
            {x: 1170, y: 767, color: 'car-pink', speed: 378, laneOffset: 10, startDelay: 0, startingTargetWP: 2},
            {x: 900, y: 813, color: 'car-yellow', speed: 396, laneOffset: 22, startDelay: 0, startingTargetWP: 3},
            {x: 1000, y: 813, color: 'car-purple', speed: 388, laneOffset: -22, startDelay: 0, startingTargetWP: 3},
            {x: 1100, y: 813, color: 'car-cyan', speed: 380, laneOffset: 0, startDelay: 0, startingTargetWP: 2}
        ]
    },
    night: {
        id: 'night',
        name: 'Sunset Sprint',
        trackKey: 'trackNight',
        maskKey: 'maskNight',
        waypoints: nightWaypoints,
        finishX: 805,
        playerStart: {x: 1265, y: 835, angle: 180, targetWP: 2},
        cpuStarts: [
            {x: 920, y: 785, color: 'car-blue', speed: 390, laneOffset: -14, startDelay: 0, startingTargetWP: 2},
            {x: 1025, y: 785, color: 'car-green', speed: 382, laneOffset: 14, startDelay: 0, startingTargetWP: 2},
            {x: 1130, y: 785, color: 'car-orange', speed: 376, laneOffset: -8, startDelay: 0, startingTargetWP: 2},
            {x: 1235, y: 785, color: 'car-pink', speed: 370, laneOffset: 8, startDelay: 0, startingTargetWP: 2},
            {x: 970, y: 835, color: 'car-yellow', speed: 386, laneOffset: 18, startDelay: 0, startingTargetWP: 2},
            {x: 1075, y: 835, color: 'car-purple', speed: 378, laneOffset: -18, startDelay: 0, startingTargetWP: 2},
            {x: 1185, y: 835, color: 'car-cyan', speed: 372, laneOffset: 0, startDelay: 0, startingTargetWP: 2}
        ]
    }
};

function storageKey(type) {
    return `f1_${currentTrackId}_${type}`;
}

function formatTime(msTime) {
    if (msTime === Infinity || !msTime) {
        return "--:--.---";
    }

    let minutes = Math.floor(msTime / 60000);
    let seconds = Math.floor((msTime % 60000) / 1000);
    let ms = Math.floor(msTime % 1000);

    return (minutes < 10 ? '0' : '') + minutes + ':' +
        (seconds < 10 ? '0' : '') + seconds + '.' +
        (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
}

function preload() {
    this.load.image('trackDay', 'track.png');
    this.load.image('maskDay', 'mask.png');
    this.load.image('trackNight', 'tracknight.png');
    this.load.image('maskNight', 'masknight.png');
}

function generateCarSprite(scene, keyName, mainColor) {
    let carGen = scene.make.graphics({
        x: 0,
        y: 0,
        add: false
    });

    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(2, 0, 6, 4, 1);
    carGen.fillRoundedRect(2, 16, 6, 4, 1);
    carGen.fillRoundedRect(17, 0, 5, 3, 1);
    carGen.fillRoundedRect(17, 17, 5, 3, 1);

    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(0, 4, 3, 12);

    carGen.fillStyle(mainColor, 1);
    carGen.fillRect(3, 6, 15, 8);
    carGen.fillRect(18, 8, 6, 4);

    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(22, 3, 3, 14);

    carGen.fillStyle(0xffffff, 1);
    carGen.fillCircle(11, 10, 2.5);

    carGen.generateTexture(keyName, 25, 20);
}

function getProgressScore(lapNumber, targetWP, x, y) {
    let target = waypoints[targetWP];
    let previousWP = targetWP - 1;

    if (previousWP < 0) {
        previousWP = waypoints.length - 1;
    }

    let previous = waypoints[previousWP];

    let segmentLength = Phaser.Math.Distance.Between(
        previous.x,
        previous.y,
        target.x,
        target.y
    );

    let distanceToTarget = Phaser.Math.Distance.Between(
        x,
        y,
        target.x,
        target.y
    );

    let segmentProgress = 0;

    if (segmentLength > 0) {
        segmentProgress = Phaser.Math.Clamp(
            1 - (distanceToTarget / segmentLength),
            0,
            1
        );
    }

    return ((lapNumber - 1) * waypoints.length) + previousWP + segmentProgress;
}

function updatePlayerTrackProgress() {
    let target = waypoints[playerTargetWP];

    let dist = Phaser.Math.Distance.Between(
        playerCar.x,
        playerCar.y,
        target.x,
        target.y
    );

    if (dist < 120) {
        playerTargetWP++;

        if (playerTargetWP >= waypoints.length) {
            playerTargetWP = 0;
        }
    }

    playerTrackProgress = getProgressScore(
        laps,
        playerTargetWP,
        playerCar.x,
        playerCar.y
    );
}

function safeShowRacePrompt(text, isGo = false) {
    if (typeof showRacePrompt === "function") {
        showRacePrompt(text, isGo);
    }
}

function safeHideRacePrompt() {
    if (typeof hideRacePrompt === "function") {
        hideRacePrompt();
    }
}

// --- SIMPLE SYNTH AUDIO ---
function initAudio() {
    if (audioReady) {
        return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return;
    }

    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioCtx.destination);

    // Player acceleration engine sound
    playerEngineOsc = audioCtx.createOscillator();
    playerEngineOsc.type = "sawtooth";

    const playerEngineFilter = audioCtx.createBiquadFilter();
    playerEngineFilter.type = "lowpass";
    playerEngineFilter.frequency.value = 700;

    playerEngineGain = audioCtx.createGain();
    playerEngineGain.gain.value = 0;

    playerEngineOsc.connect(playerEngineFilter);
    playerEngineFilter.connect(playerEngineGain);
    playerEngineGain.connect(masterGain);
    playerEngineOsc.start();

    // Player top speed layer
    playerTopOsc = audioCtx.createOscillator();
    playerTopOsc.type = "square";

    const playerTopFilter = audioCtx.createBiquadFilter();
    playerTopFilter.type = "lowpass";
    playerTopFilter.frequency.value = 1200;

    playerTopGain = audioCtx.createGain();
    playerTopGain.gain.value = 0;

    playerTopOsc.connect(playerTopFilter);
    playerTopFilter.connect(playerTopGain);
    playerTopGain.connect(masterGain);
    playerTopOsc.start();

    // Other cars engine hum, quieter
    aiEngineOsc = audioCtx.createOscillator();
    aiEngineOsc.type = "sawtooth";

    const aiEngineFilter = audioCtx.createBiquadFilter();
    aiEngineFilter.type = "lowpass";
    aiEngineFilter.frequency.value = 520;

    aiEngineGain = audioCtx.createGain();
    aiEngineGain.gain.value = 0;

    aiEngineOsc.connect(aiEngineFilter);
    aiEngineFilter.connect(aiEngineGain);
    aiEngineGain.connect(masterGain);
    aiEngineOsc.start();

    // Tire squeal noise
    const noiseBuffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate,
        audioCtx.sampleRate
    );

    const noiseData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    squealSource = audioCtx.createBufferSource();
    squealSource.buffer = noiseBuffer;
    squealSource.loop = true;

    squealFilter = audioCtx.createBiquadFilter();
    squealFilter.type = "bandpass";
    squealFilter.frequency.value = 1600;
    squealFilter.Q.value = 7;

    squealGain = audioCtx.createGain();
    squealGain.gain.value = 0;

    squealSource.connect(squealFilter);
    squealFilter.connect(squealGain);
    squealGain.connect(masterGain);
    squealSource.start();

    audioReady = true;
}

function enableAudio() {
    initAudio();

    if (!audioCtx) {
        return;
    }

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    soundUnlocked = true;
    soundEnabled = true;

    if (masterGain) {
        masterGain.gain.setTargetAtTime(0.55, audioCtx.currentTime, 0.03);
    }

    const audioBtn = document.getElementById('btn-audio');

    if (audioBtn) {
        audioBtn.textContent = "Audio: ON";
        audioBtn.classList.add('on');
    }
}

function disableAudio() {
    soundEnabled = false;
    stopAllSounds();

    if (audioCtx && masterGain) {
        masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
    }

    const audioBtn = document.getElementById('btn-audio');

    if (audioBtn) {
        audioBtn.textContent = "Audio: OFF";
        audioBtn.classList.remove('on');
    }
}

function toggleAudio() {
    if (soundEnabled) {
        disableAudio();
    } else {
        enableAudio();
    }
}

function setGainSmooth(gainNode, value, speed = 0.05) {
    if (!audioReady || !gainNode || !audioCtx) {
        return;
    }

    gainNode.gain.setTargetAtTime(
        value,
        audioCtx.currentTime,
        speed
    );
}

function setFreqSmooth(oscNode, value, speed = 0.04) {
    if (!audioReady || !oscNode || !audioCtx) {
        return;
    }

    oscNode.frequency.setTargetAtTime(
        value,
        audioCtx.currentTime,
        speed
    );
}

function playTone(freq, duration = 0.12, type = "square", volume = 0.15, delay = 0) {
    if (!soundEnabled || !audioReady || !audioCtx || audioCtx.state === "suspended") {
        return;
    }

    const startAt = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.04);
}

function playLightSound(step) {
    playTone(220 + step * 35, 0.1, "square", 0.14);
}

function playGoSound() {
    playTone(520, 0.12, "square", 0.18, 0);
    playTone(780, 0.18, "square", 0.16, 0.08);
}

function playVictorySound() {
    playTone(440, 0.12, "square", 0.14, 0);
    playTone(660, 0.12, "square", 0.14, 0.13);
    playTone(880, 0.22, "square", 0.18, 0.26);
    playTone(1320, 0.28, "triangle", 0.14, 0.5);
}

function playDefeatSound() {
    playTone(330, 0.18, "sawtooth", 0.15, 0);
    playTone(240, 0.2, "sawtooth", 0.14, 0.2);
    playTone(150, 0.35, "sawtooth", 0.15, 0.42);
}

function updateRaceSounds(isPlayerTurning, aiTurnAmount = 0) {
    if (!soundEnabled || !audioReady || !audioCtx) {
        return;
    }

    if (!raceStarted || raceFinished) {
        setGainSmooth(playerEngineGain, 0, 0.03);
        setGainSmooth(playerTopGain, 0, 0.03);
        setGainSmooth(aiEngineGain, 0, 0.03);
        setGainSmooth(squealGain, 0, 0.03);
        return;
    }

    const speedRatio = Phaser.Math.Clamp(Math.abs(currentSpeed) / 450, 0, 1);

    // Player acceleration/engine
    const playerEngineVolume = 0.025 + speedRatio * 0.13;
    const playerEngineFreq = 85 + speedRatio * 310;

    setFreqSmooth(playerEngineOsc, playerEngineFreq);
    setGainSmooth(playerEngineGain, playerEngineVolume);

    // Top speed layer comes in near max speed
    const topAmount = Phaser.Math.Clamp((speedRatio - 0.82) / 0.18, 0, 1);
    setFreqSmooth(playerTopOsc, 260 + speedRatio * 520);
    setGainSmooth(playerTopGain, topAmount * 0.045);

    // Other cars: average nearby engine sound, quieter than player
    let totalAiSpeed = 0;
    let aiCount = 0;

    if (cpuGroup) {
        cpuGroup.children.iterate(cpu => {
            if (!cpu || !cpu.body || cpu.finished) {
                return;
            }

            const v = Phaser.Math.Distance.Between(
                0,
                0,
                cpu.body.velocity.x,
                cpu.body.velocity.y
            );

            totalAiSpeed += v;
            aiCount++;
        });
    }

    const avgAiSpeed = aiCount > 0 ? totalAiSpeed / aiCount : 0;
    const aiRatio = Phaser.Math.Clamp(avgAiSpeed / 450, 0, 1);

    setFreqSmooth(aiEngineOsc, 75 + aiRatio * 260);
    setGainSmooth(aiEngineGain, aiRatio * 0.055);

    // Tire squeal
    const playerSqueal = isPlayerTurning && Math.abs(currentSpeed) > 85
        ? Phaser.Math.Clamp(speedRatio * 0.12, 0, 0.12)
        : 0;

    const aiSqueal = Phaser.Math.Clamp(aiTurnAmount * 0.025, 0, 0.035);
    const squealVolume = Math.max(playerSqueal, aiSqueal);

    if (squealFilter) {
        squealFilter.frequency.setTargetAtTime(
            1350 + speedRatio * 700,
            audioCtx.currentTime,
            0.04
        );
    }

    setGainSmooth(squealGain, squealVolume, 0.025);
}

function stopAllSounds() {
    setGainSmooth(playerEngineGain, 0, 0.02);
    setGainSmooth(playerTopGain, 0, 0.02);
    setGainSmooth(aiEngineGain, 0, 0.02);
    setGainSmooth(squealGain, 0, 0.02);
}

function stopAllCars() {
    currentSpeed = 0;

    if (playerCar && playerCar.body) {
        playerCar.body.setVelocity(0);
        playerCar.body.setAngularVelocity(0);
    }

    if (cpuGroup) {
        cpuGroup.children.iterate(cpu => {
            if (cpu && cpu.body) {
                cpu.body.setVelocity(0);
                cpu.body.setAngularVelocity(0);
            }
        });
    }

    stopAllSounds();
}

function triggerAIRaceWin(time) {
    raceFinished = true;

    document.getElementById('lap-counter').innerText = "FINISH";

    stopAllCars();

    let totalRaceTime = time - startTime;

    document.getElementById('res-position').style.color = '#e10600';
    document.getElementById('res-position').innerText = "YOU LOSE";

    document.getElementById('res-final').innerText = formatTime(totalRaceTime);
    document.getElementById('res-best').innerText = formatTime(bestLapTime);
    document.getElementById('results-modal').classList.add('show');

    playDefeatSound();
}

function triggerRaceFinish(time) {
    raceFinished = true;

    document.getElementById('lap-counter').innerText = "FINISH";

    stopAllCars();

    let totalRaceTime = time - startTime;

    document.getElementById('res-position').style.color = '#fff';
    document.getElementById('res-position').innerText = "POSITION: 1st 🏆";

    if (totalRaceTime < bestRaceTime) {
        bestRaceTime = totalRaceTime;
        localStorage.setItem(storageKey('bestRace'), bestRaceTime);
        document.getElementById('best-race').innerText = formatTime(bestRaceTime);
    }

    document.getElementById('res-final').innerText = formatTime(totalRaceTime);
    document.getElementById('res-best').innerText = formatTime(bestLapTime);
    document.getElementById('results-modal').classList.add('show');

    playVictorySound();
}

function readSelectedTrackBestTimes() {
    bestLapTime = parseFloat(localStorage.getItem(storageKey('bestLap'))) || Infinity;
    bestRaceTime = parseFloat(localStorage.getItem(storageKey('bestRace'))) || Infinity;

    document.getElementById('best-lap').innerText = formatTime(bestLapTime);
    document.getElementById('best-race').innerText = formatTime(bestRaceTime);
}

function resetRaceStateForTrack(trackConfig) {
    selectedTrackConfig = trackConfig;
    currentTrackId = trackConfig.id;
    currentTrackName = trackConfig.name;
    currentFinishX = trackConfig.finishX;
    waypoints = trackConfig.waypoints;

    raceStarted = false;
    raceFinished = false;
    startTime = 0;
    lapStartTime = 0;
    laps = 1;
    checkpointReached = false;
    currentSpeed = 0;
    maxSpeed = 450;

    playerTargetWP = trackConfig.playerStart.targetWP || 2;
    playerTrackProgress = 0;

    document.getElementById('lap-counter').innerText = '1';
    document.getElementById('timer-display').innerText = '00:00.000';
    document.getElementById('results-modal').classList.remove('show');

    document.querySelectorAll('.light').forEach(light => {
        light.classList.remove('on');
    });

    safeHideRacePrompt();
    readSelectedTrackBestTimes();
}

function loadMaskDataForTrack(scene, maskKey) {
    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 900;

    let ctx = offscreenCanvas.getContext('2d', {
        willReadFrequently: true
    });

    let srcMask = scene.textures.get(maskKey).getSourceImage();
    ctx.drawImage(srcMask, 0, 0, 1600, 900);
    maskData = ctx.getImageData(0, 0, 1600, 900).data;
}

function startLightSequence(scene) {
    let lightStep = 0;

    const lightsEl = document.getElementById('start-lights');
    lightsEl.style.display = 'flex';

    safeShowRacePrompt('YOU ARE THE RED CAR');

    let lightInterval = setInterval(() => {
        lightStep++;

        if (lightStep <= 5) {
            document.getElementById(`light-${lightStep}`).classList.add('on');
            playLightSound(lightStep);

            if (lightStep <= 2) {
                safeShowRacePrompt('YOU ARE THE RED CAR');
            } else {
                safeShowRacePrompt('GET READY');
            }
        } else {
            clearInterval(lightInterval);

            document.querySelectorAll('.light').forEach(light => {
                light.classList.remove('on');
            });

            lightsEl.style.display = 'none';

            safeShowRacePrompt('GO!', true);
            playGoSound();

            setTimeout(() => {
                safeHideRacePrompt();
            }, 900);

            raceStarted = true;
            startTime = scene.time.now;
            lapStartTime = startTime;
        }
    }, 1000);
}

function buildRaceForTrack(scene, trackConfig) {
    resetRaceStateForTrack(trackConfig);

    if (trackBackground) {
        trackBackground.setTexture(trackConfig.trackKey);
    } else {
        trackBackground = scene.add.image(800, 450, trackConfig.trackKey);
        trackBackground.setDisplaySize(1600, 900);
        trackBackground.setDepth(0);
    }

    loadMaskDataForTrack(scene, trackConfig.maskKey);

    if (cpuGroup) {
        cpuGroup.clear(true, true);
    } else {
        cpuGroup = scene.physics.add.group();
    }

    if (playerCar) {
        playerCar.destroy();
    }

    const spawnCPU = (x, y, color, speed, laneOffset = 0, startDelay = 0, startingTargetWP = 2) => {
        let cpu = cpuGroup.create(x, y, color);

        cpu.targetWP = startingTargetWP;
        cpu.baseSpeed = speed;
        cpu.speed = speed;
        cpu.laneOffset = laneOffset;
        cpu.startDelay = startDelay;
        cpu.laps = 1;
        cpu.checkpointReached = false;
        cpu.prevX = cpu.x;
        cpu.trackProgress = 0;
        cpu.finished = false;
        cpu.finishTime = null;

        cpu.setDepth(10);
        cpu.angle = trackConfig.playerStart.angle;
        cpu.body.setCollideWorldBounds(true);
        cpu.body.setBounce(0.15);
        cpu.body.setMass(0.8);
        cpu.body.setDrag(20);
    };

    trackConfig.cpuStarts.forEach(cpu => {
        spawnCPU(
            cpu.x,
            cpu.y,
            cpu.color,
            cpu.speed,
            cpu.laneOffset,
            cpu.startDelay,
            cpu.startingTargetWP
        );
    });

    playerCar = scene.physics.add.sprite(
        trackConfig.playerStart.x,
        trackConfig.playerStart.y,
        'car-red'
    );

    playerCar.setDepth(10);
    playerCar.angle = trackConfig.playerStart.angle;
    playerCar.body.setCollideWorldBounds(true);
    playerCar.body.setBounce(0.4);
    playerCar.body.setMass(1);

    prevX = playerCar.x;
    prevY = playerCar.y;

    scene.physics.add.collider(playerCar, cpuGroup);
    scene.physics.add.overlap(cpuGroup, cpuGroup);

    startLightSequence(scene);
}

function create() {
    const audioBtn = document.getElementById('btn-audio');

    if (audioBtn) {
        audioBtn.textContent = 'Audio: OFF';
        audioBtn.classList.remove('on');
        audioBtn.addEventListener('click', toggleAudio);
    }

    document.getElementById('best-lap').innerText = formatTime(Infinity);
    document.getElementById('best-race').innerText = formatTime(Infinity);
    document.getElementById('start-lights').style.display = 'none';

    generateCarSprite(this, 'car-red', 0xe10600);
    generateCarSprite(this, 'car-blue', 0x0055ff);
    generateCarSprite(this, 'car-yellow', 0xffcc00);
    generateCarSprite(this, 'car-green', 0x00ff00);
    generateCarSprite(this, 'car-purple', 0x9900ff);
    generateCarSprite(this, 'car-orange', 0xff6600);
    generateCarSprite(this, 'car-cyan', 0x00ffff);
    generateCarSprite(this, 'car-pink', 0xff00ff);

    cursors = this.input.keyboard.createCursorKeys();

    const bindBtn = (id, keydown, keyup) => {
        const btn = document.getElementById(id);

        if (!btn) {
            return;
        }

        const press = (e) => {
            e.preventDefault();

            if (e.pointerId !== undefined && btn.setPointerCapture) {
                try {
                    btn.setPointerCapture(e.pointerId);
                } catch (err) {
                    // Some mobile browsers may not allow pointer capture here.
                }
            }

            keydown();
        };

        const release = (e) => {
            e.preventDefault();
            keyup();
        };

        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };

    bindBtn('btn-left', () => mobileLeft = true, () => mobileLeft = false);
    bindBtn('btn-right', () => mobileRight = true, () => mobileRight = false);
    bindBtn('btn-gas', () => mobileGas = true, () => mobileGas = false);
    bindBtn('btn-brake', () => mobileBrake = true, () => mobileBrake = false);

    const trackSelectModal = document.getElementById('track-select-modal');
    const chooseDayBtn = document.getElementById('btn-track-day');
    const chooseNightBtn = document.getElementById('btn-track-night');

    if (trackSelectModal) {
        trackSelectModal.classList.add('show');
    }

    const chooseTrack = (trackId) => {
        if (trackSelectModal) {
            trackSelectModal.classList.remove('show');
        }

        buildRaceForTrack(this, TRACKS[trackId]);
    };

    if (chooseDayBtn) {
        chooseDayBtn.addEventListener('click', () => chooseTrack('day'));
    }

    if (chooseNightBtn) {
        chooseNightBtn.addEventListener('click', () => chooseTrack('night'));
    }
}

function update(time) {
    if (!raceStarted || raceFinished || !playerCar || !cpuGroup) {
        stopAllCars();
        return;
    }

    let aiTurnAmount = 0;

    // --- CPU AI LOGIC ---
    cpuGroup.children.iterate((cpu) => {
        if (!cpu) {
            return;
        }

        if (cpu.finished) {
            cpu.body.setVelocity(0);
            return;
        }

        let target = waypoints[cpu.targetWP];

        let dist = Phaser.Math.Distance.Between(
            cpu.x,
            cpu.y,
            target.x,
            target.y
        );

        if (dist < CPU_WAYPOINT_REACH_RADIUS) {
            cpu.targetWP++;

            if (cpu.targetWP >= waypoints.length) {
                cpu.targetWP = 0;
            }

            target = waypoints[cpu.targetWP];
        }

        cpu.trackProgress = getProgressScore(
            cpu.laps,
            cpu.targetWP,
            cpu.x,
            cpu.y
        );

        let nextWP = waypoints[(cpu.targetWP + 1) % waypoints.length];

        let pathAngle = Phaser.Math.Angle.Between(
            target.x,
            target.y,
            nextWP.x,
            nextWP.y
        );

        let offsetX = Math.cos(pathAngle + Math.PI / 2) * cpu.laneOffset;
        let offsetY = Math.sin(pathAngle + Math.PI / 2) * cpu.laneOffset;

        let targetX = target.x + offsetX;
        let targetY = target.y + offsetY;

        let targetAngle = Phaser.Math.Angle.Between(
            cpu.x,
            cpu.y,
            targetX,
            targetY
        );

        let angleDiff = Phaser.Math.Angle.Wrap(targetAngle - cpu.rotation);

        aiTurnAmount = Math.max(aiTurnAmount, Math.abs(angleDiff));

        let turnSpeed = 0.12;

        if (Math.abs(angleDiff) > 1.0) {
            turnSpeed = 0.26;
        } else if (Math.abs(angleDiff) > 0.5) {
            turnSpeed = 0.18;
        }

        cpu.rotation = Phaser.Math.Angle.RotateTo(
            cpu.rotation,
            targetAngle,
            turnSpeed
        );

        let targetSpeed = cpu.baseSpeed || cpu.speed;

        if (time - startTime < cpu.startDelay) {
            targetSpeed = 0;
        }

        if (Math.abs(angleDiff) > 0.9) {
            targetSpeed *= CPU_SHARP_TURN_SLOWDOWN;
        } else if (Math.abs(angleDiff) > 0.45) {
            targetSpeed *= CPU_MEDIUM_TURN_SLOWDOWN;
        }

        this.physics.velocityFromRotation(
            cpu.rotation,
            targetSpeed,
            cpu.body.velocity
        );

        // CPU lap logic
        if (cpu.y < 350) {
            cpu.checkpointReached = true;
        }

        if (
            cpu.checkpointReached &&
            cpu.y > 700 &&
            cpu.prevX > currentFinishX &&
            cpu.x <= currentFinishX
        ) {
            cpu.laps++;
            cpu.checkpointReached = false;

            if (cpu.laps > maxLaps) {
                cpu.finished = true;
                cpu.finishTime = time;
                cpu.trackProgress = maxLaps * waypoints.length;
                cpu.body.setVelocity(0);

                // If any AI finishes first, the player loses.
                if (!raceFinished) {
                    triggerAIRaceWin(time);
                }
            }
        }

        cpu.prevX = cpu.x;
    });

    if (raceFinished) {
        return;
    }

    // --- PLAYER MASK LOGIC ---
    let x = Math.floor(playerCar.x);
    let y = Math.floor(playerCar.y);

    if (maskData && x >= 0 && x < 1600 && y >= 0 && y < 900) {
        let index = (y * 1600 + x) * 4;

        let r = maskData[index];
        let g = maskData[index + 1];
        let b = maskData[index + 2];
        let a = maskData[index + 3];

        if (a === 0) {
            maxSpeed = 450;
        } else if (r < 100 && g < 100 && b < 100) {
            playerCar.x = prevX;
            playerCar.y = prevY;
            currentSpeed = -currentSpeed * 0.5;
        } else if (r > 100 && g < 100 && b < 100) {
            maxSpeed = 275;
        } else {
            maxSpeed = 450;
        }
    }

    // --- PLAYER CONTROLS ---
    if (cursors.up.isDown || mobileGas) {
        currentSpeed += 15;
    } else if (cursors.down.isDown || mobileBrake) {
        currentSpeed -= 20;
    } else {
        currentSpeed *= 0.92;
    }

    currentSpeed = Phaser.Math.Clamp(
        currentSpeed,
        -150,
        maxSpeed
    );

    playerCar.body.setAngularVelocity(0);

    let turnSpeed = currentSpeed > 50 ? 250 : 150;
    let isPlayerTurning = false;

    if (cursors.left.isDown || mobileLeft) {
        playerCar.body.setAngularVelocity(-turnSpeed);
        isPlayerTurning = true;
    } else if (cursors.right.isDown || mobileRight) {
        playerCar.body.setAngularVelocity(turnSpeed);
        isPlayerTurning = true;
    }

    this.physics.velocityFromRotation(
        playerCar.rotation,
        currentSpeed,
        playerCar.body.velocity
    );

    updateRaceSounds(isPlayerTurning, aiTurnAmount);
    updatePlayerTrackProgress();

    // --- PLAYER LAP LOGIC ---
    if (playerCar.y < 350) {
        checkpointReached = true;
    }

    if (
        checkpointReached &&
        playerCar.y > 700 &&
        prevX > currentFinishX &&
        playerCar.x <= currentFinishX
    ) {
        let thisLapTime = time - lapStartTime;

        if (thisLapTime < bestLapTime) {
            bestLapTime = thisLapTime;
            localStorage.setItem(storageKey('bestLap'), bestLapTime);
            document.getElementById('best-lap').innerText = formatTime(bestLapTime);
        }

        lapStartTime = time;

        laps++;
        checkpointReached = false;

        if (laps > maxLaps) {
            // If player finishes before any AI, player wins.
            triggerRaceFinish(time);
        } else {
            document.getElementById('lap-counter').innerText = laps;
        }
    }

    prevX = playerCar.x;
    prevY = playerCar.y;

    if (!raceFinished && raceStarted) {
        let elapsedTime = time - startTime;
        document.getElementById('timer-display').innerText = formatTime(elapsedTime);
    }
}