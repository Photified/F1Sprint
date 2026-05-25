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
const CPU_WAYPOINT_REACH_RADIUS = 48;
const CPU_SHARP_TURN_SLOWDOWN = 0.58;
const CPU_MEDIUM_TURN_SLOWDOWN = 0.74;

// --- RACING LINE ---
const waypoints = [
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
    this.load.image('trackImg', 'track.png');
    this.load.image('maskImg', 'mask.png');
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
        localStorage.setItem('f1_bestRace', bestRaceTime);
        document.getElementById('best-race').innerText = formatTime(bestRaceTime);
    }

    document.getElementById('res-final').innerText = formatTime(totalRaceTime);
    document.getElementById('res-best').innerText = formatTime(bestLapTime);
    document.getElementById('results-modal').classList.add('show');
}

function create() {
    bestLapTime = parseFloat(localStorage.getItem('f1_bestLap')) || Infinity;
    bestRaceTime = parseFloat(localStorage.getItem('f1_bestRace')) || Infinity;

    document.getElementById('best-lap').innerText = formatTime(bestLapTime);
    document.getElementById('best-race').innerText = formatTime(bestRaceTime);

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900);

    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 900;

    let ctx = offscreenCanvas.getContext('2d', {
        willReadFrequently: true
    });

    let srcMask = this.textures.get('maskImg').getSourceImage();

    ctx.drawImage(srcMask, 0, 0, 1600, 900);
    maskData = ctx.getImageData(0, 0, 1600, 900).data;

    generateCarSprite(this, 'car-red', 0xe10600);
    generateCarSprite(this, 'car-blue', 0x0055ff);
    generateCarSprite(this, 'car-yellow', 0xffcc00);
    generateCarSprite(this, 'car-green', 0x00ff00);
    generateCarSprite(this, 'car-purple', 0x9900ff);
    generateCarSprite(this, 'car-orange', 0xff6600);
    generateCarSprite(this, 'car-cyan', 0x00ffff);
    generateCarSprite(this, 'car-pink', 0xff00ff);

    cpuGroup = this.physics.add.group();

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
        cpu.angle = 180;

        cpu.body.setCollideWorldBounds(true);
        cpu.body.setBounce(0.15);
        cpu.body.setMass(0.8);
        cpu.body.setDrag(20);
    };

    // Slower AI version.
    // No start delays, so the player does not plow into parked cars.
    // Cars 1, 2, 5, and 6 start toward waypoint 3 to avoid starting swirl.
    spawnCPU(870, 767, 'car-blue', 400, -18, 0, 3);
    spawnCPU(970, 767, 'car-green', 392, 18, 0, 3);
    spawnCPU(1070, 767, 'car-orange', 385, -10, 0, 2);
    spawnCPU(1170, 767, 'car-pink', 378, 10, 0, 2);

    spawnCPU(900, 813, 'car-yellow', 396, 22, 0, 3);
    spawnCPU(1000, 813, 'car-purple', 388, -22, 0, 3);
    spawnCPU(1100, 813, 'car-cyan', 380, 0, 0, 2);

    // PLAYER - Grid 8
    playerCar = this.physics.add.sprite(1200, 813, 'car-red');
    playerCar.setDepth(10);
    playerCar.angle = 180;

    playerCar.body.setCollideWorldBounds(true);
    playerCar.body.setBounce(0.4);
    playerCar.body.setMass(1);

    prevX = playerCar.x;
    prevY = playerCar.y;

    this.physics.add.collider(playerCar, cpuGroup);
    this.physics.add.overlap(cpuGroup, cpuGroup);

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

    // --- START LIGHTS + PROMPT ---
    let lightStep = 0;

    safeShowRacePrompt("YOU ARE THE RED CAR");

    let lightInterval = setInterval(() => {
        lightStep++;

        if (lightStep <= 5) {
            document.getElementById(`light-${lightStep}`).classList.add('on');

            if (lightStep <= 2) {
                safeShowRacePrompt("YOU ARE THE RED CAR");
            } else {
                safeShowRacePrompt("GET READY");
            }
        } else {
            clearInterval(lightInterval);

            document.querySelectorAll('.light').forEach(light => {
                light.classList.remove('on');
            });

            document.getElementById('start-lights').style.display = 'none';

            safeShowRacePrompt("GO!", true);

            setTimeout(() => {
                safeHideRacePrompt();
            }, 900);

            raceStarted = true;
            startTime = this.time.now;
            lapStartTime = startTime;
        }
    }, 1000);
}

function update(time) {
    if (!raceStarted || raceFinished) {
        stopAllCars();
        return;
    }

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
            cpu.prevX > 730 &&
            cpu.x <= 730
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

    if (cursors.left.isDown || mobileLeft) {
        playerCar.body.setAngularVelocity(-turnSpeed);
    } else if (cursors.right.isDown || mobileRight) {
        playerCar.body.setAngularVelocity(turnSpeed);
    }

    this.physics.velocityFromRotation(
        playerCar.rotation,
        currentSpeed,
        playerCar.body.velocity
    );

    updatePlayerTrackProgress();

    // --- PLAYER LAP LOGIC ---
    if (playerCar.y < 350) {
        checkpointReached = true;
    }

    if (
        checkpointReached &&
        playerCar.y > 700 &&
        prevX > 730 &&
        playerCar.x <= 730
    ) {
        let thisLapTime = time - lapStartTime;

        if (thisLapTime < bestLapTime) {
            bestLapTime = thisLapTime;
            localStorage.setItem('f1_bestLap', bestLapTime);
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