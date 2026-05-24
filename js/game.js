const config = {
    type: Phaser.AUTO,
    width: 1600,
    height: 900,
    parent: 'game-container',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let playerCar;
let cpuGroup;
let cursors;

// RACE STATE
let raceStarted = false;
let raceFinished = false;
let startTime = 0, laps = 1, maxLaps = 3;
let checkpointReached = false;

let lapStartTime = 0;
let bestLapTime = Infinity;
let bestRaceTime = Infinity;

let maskData = null;
let prevX, prevY;
let currentSpeed = 0;
let maxSpeed = 450;

let mobileLeft = false, mobileRight = false, mobileGas = false, mobileBrake = false;

// --- PERFECTED RACING LINE ---
const waypoints = [
    // Bottom straight
    {x: 1375, y: 792},
    {x: 1180, y: 792},
    {x: 980, y: 795},
    {x: 760, y: 805},
    {x: 520, y: 810},
    {x: 300, y: 805},

    // Bottom-left corner: wide entry, apex, wide exit
    {x: 205, y: 775},
    {x: 145, y: 725},
    {x: 130, y: 665},
    {x: 155, y: 610},
    {x: 225, y: 575},
    {x: 340, y: 558},
    {x: 475, y: 550},

    // Left-middle right bend
    {x: 575, y: 535},
    {x: 635, y: 500},
    {x: 660, y: 455},
    {x: 640, y: 415},
    {x: 575, y: 390},
    {x: 470, y: 378},
    {x: 335, y: 370},
    {x: 245, y: 360},

    // Top-left corner: wide entry, apex, wide exit
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

     // Top-right corner: wide entry, apex, wide exit
  {x: 1415, y: 200},
  {x: 1460, y: 255},
  {x: 1455, y: 315},
  {x: 1405, y: 355},
  {x: 1310, y: 370},
  {x: 1190, y: 370},

  // Right inner loop: force cars higher before turning down/right
  {x: 1060, y: 385},
  {x: 960, y: 420},
  {x: 900, y: 475},
  {x: 885, y: 535},
  {x: 925, y: 580},
  {x: 1025, y: 600},

  // Stay high/wide before corner entry
  {x: 1160, y: 595},
  {x: 1290, y: 590},
  {x: 1400, y: 600},

  // Final corner: outside first, then turn in
  {x: 1470, y: 625},
  {x: 1510, y: 675},
  {x: 1510, y: 730},
  {x: 1475, y: 775},
  {x: 1375, y: 792}
];

function formatTime(msTime) {
    if (msTime === Infinity || !msTime) return "--:--.---";

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
    let carGen = scene.make.graphics({ x: 0, y: 0, add: false });

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

    let ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

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

    const spawnCPU = (x, y, color, speed) => {
        let cpu = cpuGroup.create(x, y, color);

        cpu.targetWP = 2;
        cpu.baseSpeed = speed;
        cpu.speed = speed;

        cpu.laps = 1;
        cpu.checkpointReached = false;
        cpu.prevX = cpu.x;

        cpu.setDepth(10);
        cpu.angle = 180;

        cpu.body.setCollideWorldBounds(true);
        cpu.body.setBounce(0.5);
        cpu.body.setMass(1.5);
    };

    // --- ALIGNED & STAGGERED 8-CAR GRID ---

    // Top Row
    spawnCPU(870, 767, 'car-blue', 400);
    spawnCPU(970, 767, 'car-green', 380);
    spawnCPU(1070, 767, 'car-orange', 360);
    spawnCPU(1170, 767, 'car-pink', 340);

    // Bottom Row
    spawnCPU(900, 813, 'car-yellow', 390);
    spawnCPU(1000, 813, 'car-purple', 370);
    spawnCPU(1100, 813, 'car-cyan', 350);

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
    this.physics.add.collider(cpuGroup, cpuGroup);

    cursors = this.input.keyboard.createCursorKeys();

    const bindBtn = (id, keydown, keyup) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keydown();
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keyup();
        });

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            keydown();
        });

        btn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            keyup();
        });
    };

    bindBtn('btn-left', () => mobileLeft = true, () => mobileLeft = false);
    bindBtn('btn-right', () => mobileRight = true, () => mobileRight = false);
    bindBtn('btn-gas', () => mobileGas = true, () => mobileGas = false);
    bindBtn('btn-brake', () => mobileBrake = true, () => mobileBrake = false);

    let lightStep = 0;

    let lightInterval = setInterval(() => {
        lightStep++;

        if (lightStep <= 5) {
            document.getElementById(`light-${lightStep}`).classList.add('on');
        } else {
            clearInterval(lightInterval);

            document.querySelectorAll('.light').forEach(l => l.classList.remove('on'));
            document.getElementById('start-lights').style.display = 'none';

            raceStarted = true;
            startTime = this.time.now;
            lapStartTime = startTime;
        }
    }, 1000);
}

function calculatePlayerPosition() {
    let rank = 1;

    cpuGroup.children.iterate((cpu) => {
        if (cpu.laps > laps) {
            rank++;
        } else if (cpu.laps === laps) {
            if (cpu.checkpointReached && !checkpointReached) {
                rank++;
            } else if (cpu.checkpointReached && checkpointReached) {
                if (cpu.x < playerCar.x) rank++;
            }
        }
    });

    return rank;
}

function triggerRaceFinish(time) {
    raceFinished = true;

    document.getElementById('lap-counter').innerText = "FINISH";

    currentSpeed = 0;
    playerCar.body.setVelocity(0);

    cpuGroup.children.iterate(cpu => cpu.body.setVelocity(0));

    let totalRaceTime = time - startTime;
    let finalRank = calculatePlayerPosition();

    let suffix = "th";
    if (finalRank === 1) suffix = "st";
    if (finalRank === 2) suffix = "nd";
    if (finalRank === 3) suffix = "rd";

    document.getElementById('res-position').innerText = `POSITION: ${finalRank}${suffix}`;

    if (finalRank === 1) {
        document.getElementById('res-position').style.color = '#fff';
        document.getElementById('res-position').innerText += " 🏆";

        if (totalRaceTime < bestRaceTime) {
            bestRaceTime = totalRaceTime;
            localStorage.setItem('f1_bestRace', bestRaceTime);
            document.getElementById('best-race').innerText = formatTime(bestRaceTime);
        }
    } else {
        document.getElementById('res-position').style.color = '#e10600';
    }

    document.getElementById('res-final').innerText = formatTime(totalRaceTime);
    document.getElementById('res-best').innerText = formatTime(bestLapTime);
    document.getElementById('results-modal').classList.add('show');
}

function update(time) {
    if (!raceStarted || raceFinished) {
        playerCar.body.setVelocity(0);

        cpuGroup.children.iterate(cpu => cpu.body.setVelocity(0));
        return;
    }

    // --- CPU AI LOGIC ---
    cpuGroup.children.iterate((cpu) => {
        let target = waypoints[cpu.targetWP];

        let dist = Phaser.Math.Distance.Between(
            cpu.x,
            cpu.y,
            target.x,
            target.y
        );

        // This is your waypointRadius.
        // Smaller number = cars must get closer before switching points.
        // 45 is much better than 90 for this track.
        if (dist < 35) {
            cpu.targetWP++;

            if (cpu.targetWP >= waypoints.length) {
                cpu.targetWP = 0;
            }

            target = waypoints[cpu.targetWP];
        }

        let targetAngle = Phaser.Math.Angle.Between(
            cpu.x,
            cpu.y,
            target.x,
            target.y
        );

        let angleDiff = Phaser.Math.Angle.Wrap(targetAngle - cpu.rotation);

        // Dynamic turning.
        // Cars turn harder when the next point requires a sharper angle.
        let turnSpeed = 0.12;

        if (Math.abs(angleDiff) > 1.0) {
            turnSpeed = 0.22;
        } else if (Math.abs(angleDiff) > 0.5) {
            turnSpeed = 0.16;
        }

        cpu.rotation = Phaser.Math.Angle.RotateTo(
            cpu.rotation,
            targetAngle,
            turnSpeed
        );

        // Dynamic speed.
        // Cars slow down for corners so they do not overshoot the track.
        let targetSpeed = cpu.baseSpeed || cpu.speed;

        if (Math.abs(angleDiff) > 0.8) {
            targetSpeed *= 0.55;
        } else if (Math.abs(angleDiff) > 0.4) {
            targetSpeed *= 0.75;
        }

        this.physics.velocityFromRotation(
            cpu.rotation,
            targetSpeed,
            cpu.body.velocity
        );

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
                triggerRaceFinish(time);
            }
        }

        cpu.prevX = cpu.x;
    });

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
            maxSpeed = 100;
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

    currentSpeed = Phaser.Math.Clamp(currentSpeed, -150, maxSpeed);

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