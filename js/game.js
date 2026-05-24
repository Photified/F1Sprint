const SHOW_WAYPOINTS = false; // Set to true if you ever want to see the AI path again!

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

// --- STRICTLY MAPPED ASPHALT WAYPOINTS ---
const waypoints = [
    {x: 1000, y: 810}, {x: 800, y: 810}, {x: 400, y: 810}, {x: 250, y: 810}, 
    {x: 160, y: 770}, {x: 130, y: 720}, {x: 160, y: 640}, 
    {x: 250, y: 600}, {x: 550, y: 600}, 
    {x: 700, y: 580}, {x: 780, y: 480}, {x: 700, y: 390}, 
    {x: 550, y: 370}, {x: 250, y: 370}, 
    {x: 160, y: 340}, {x: 130, y: 260}, {x: 160, y: 180}, 
    {x: 250, y: 150}, {x: 800, y: 150}, {x: 1300, y: 150}, 
    {x: 1420, y: 180}, {x: 1470, y: 250}, {x: 1420, y: 350}, 
    {x: 1300, y: 390}, {x: 1150, y: 430}, {x: 1020, y: 500}, 
    {x: 1100, y: 580}, {x: 1250, y: 620}, 
    {x: 1420, y: 650}, {x: 1470, y: 730}, {x: 1420, y: 790}, 
    {x: 1300, y: 810}, {x: 1100, y: 810}
];

function formatTime(msTime) {
    if (msTime === Infinity || !msTime) return "--:--.---";
    let minutes = Math.floor(msTime / 60000);
    let seconds = Math.floor((msTime % 60000) / 1000);
    let ms = Math.floor((msTime % 1000));
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
    carGen.fillRoundedRect(2, 0, 6, 4, 1); carGen.fillRoundedRect(2, 16, 6, 4, 1);  
    carGen.fillRoundedRect(17, 0, 5, 3, 1); carGen.fillRoundedRect(17, 17, 5, 3, 1); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(0, 4, 3, 12);
    carGen.fillStyle(mainColor, 1); carGen.fillRect(3, 6, 15, 8); carGen.fillRect(18, 8, 6, 4); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(22, 3, 3, 14);
    carGen.fillStyle(0xffffff, 1); carGen.fillCircle(11, 10, 2.5);
    carGen.generateTexture(keyName, 25, 20);
}

function create() {
    bestLapTime = parseFloat(localStorage.getItem('f1_bestLap')) || Infinity;
    bestRaceTime = parseFloat(localStorage.getItem('f1_bestRace')) || Infinity;
    
    document.getElementById('best-lap').innerText = formatTime(bestLapTime);
    document.getElementById('best-race').innerText = formatTime(bestRaceTime);

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    if (SHOW_WAYPOINTS) {
        let wpGraphics = this.add.graphics();
        wpGraphics.fillStyle(0xffff00, 0.8); 
        waypoints.forEach((wp, index) => {
            wpGraphics.fillCircle(wp.x, wp.y, 8);
            if(index > 0) {
                wpGraphics.lineStyle(2, 0xffff00, 0.5);
                wpGraphics.lineBetween(waypoints[index-1].x, waypoints[index-1].y, wp.x, wp.y);
            }
        });
        wpGraphics.lineBetween(waypoints[waypoints.length-1].x, waypoints[waypoints.length-1].y, waypoints[0].x, waypoints[0].y);
    }

    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 900;
    let ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    
    let srcMask = this.textures.get('maskImg').getSourceImage();
    ctx.drawImage(srcMask, 0, 0, 1600, 900);
    maskData = ctx.getImageData(0, 0, 1600, 900).data;

    // GENERATE 8 CAR COLORS
    generateCarSprite(this, 'car-red', 0xe10600);    // Player
    generateCarSprite(this, 'car-blue', 0x0055ff);   // CPU 1
    generateCarSprite(this, 'car-yellow', 0xffcc00); // CPU 2
    generateCarSprite(this, 'car-green', 0x00ff00);  // CPU 3
    generateCarSprite(this, 'car-purple', 0x9900ff); // CPU 4
    generateCarSprite(this, 'car-orange', 0xff6600); // CPU 5
    generateCarSprite(this, 'car-cyan', 0x00ffff);   // CPU 6
    generateCarSprite(this, 'car-pink', 0xff00ff);   // CPU 7

    cpuGroup = this.physics.add.group();
    
    // --- 8-CAR STARTING GRID ---
    const spawnCPU = (x, y, color, speed) => {
        let cpu = cpuGroup.create(x, y, color);
        cpu.targetWP = 2; // Aim slightly ahead
        cpu.speed = speed;
        cpu.laps = 1;
        cpu.checkpointReached = false;
        cpu.prevX = cpu.x;
        cpu.setDepth(10);
        cpu.angle = 180;
        cpu.body.setCollideWorldBounds(true);
        cpu.body.setBounce(0.5); 
        cpu.body.setMass(1.5); // Slightly heavier than player
    };

    // Staggered speeds based on your ~13s lap time so they don't bunch up forever
    spawnCPU(780, 780, 'car-blue', 400);   // Pole
    spawnCPU(780, 840, 'car-yellow', 390); // 2nd
    spawnCPU(860, 780, 'car-green', 380);  // 3rd
    spawnCPU(860, 840, 'car-purple', 370); // 4th
    spawnCPU(940, 780, 'car-orange', 360); // 5th
    spawnCPU(940, 840, 'car-cyan', 350);   // 6th
    spawnCPU(1020, 780, 'car-pink', 340);  // 7th

    // PLAYER - Grid 8 (Dead Last)
    playerCar = this.physics.add.sprite(1020, 840, 'car-red');
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
        if(!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keydown(); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keyup(); });
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); keydown(); });
        btn.addEventListener('mouseup', (e) => { e.preventDefault(); keyup(); });
    };

    bindBtn('btn-left', () => mobileLeft = true, () => mobileLeft = false);
    bindBtn('btn-right', () => mobileRight = true, () => mobileRight = false);
    bindBtn('btn-gas', () => mobileGas = true, () => mobileGas = false);
    bindBtn('btn-brake', () => mobileBrake = true, () => mobileBrake = false);

    // --- 5 LIGHT COUNTDOWN ---
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

// Determines Player Position based on CPU progress
function calculatePlayerPosition() {
    let rank = 1;
    cpuGroup.children.iterate((cpu) => {
        if (cpu.laps > laps) {
            rank++;
        } else if (cpu.laps === laps) {
            // Both on same lap. Check who is further along the track.
            if (cpu.checkpointReached && !checkpointReached) {
                rank++;
            } else if (cpu.checkpointReached && checkpointReached) {
                // Both on final stretch (bottom straight going left)
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
    
    // Only save Best Race if Player gets 1st
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
        let dist = Phaser.Math.Distance.Between(cpu.x, cpu.y, target.x, target.y);
        
        if (dist < 80) {
            cpu.targetWP++;
            if (cpu.targetWP >= waypoints.length) cpu.targetWP = 0; 
            target = waypoints[cpu.targetWP];
        }

        let targetAngle = Phaser.Math.Angle.Between(cpu.x, cpu.y, target.x, target.y);
        // Smoothed turning so they don't jerk around
        cpu.rotation = Phaser.Math.Angle.RotateTo(cpu.rotation, targetAngle, 0.08);
        this.physics.velocityFromRotation(cpu.rotation, cpu.speed, cpu.body.velocity);

        // CPU LAP TRACKING
        if (cpu.y < 350) cpu.checkpointReached = true;

        if (cpu.checkpointReached && cpu.y > 700 && cpu.prevX > 730 && cpu.x <= 730) {
            cpu.laps++;
            cpu.checkpointReached = false;
            
            // SUDDEN DEATH: CPU finishes first!
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

        if (a === 0) { maxSpeed = 450; } 
        else if (r < 100 && g < 100 && b < 100) {
            playerCar.x = prevX;
            playerCar.y = prevY;
            currentSpeed = -currentSpeed * 0.5; 
        } 
        else if (r > 100 && g < 100 && b < 100) { maxSpeed = 100; } 
        else { maxSpeed = 450; }
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
    
    if (cursors.left.isDown || mobileLeft) playerCar.body.setAngularVelocity(-turnSpeed);
    else if (cursors.right.isDown || mobileRight) playerCar.body.setAngularVelocity(turnSpeed);

    this.physics.velocityFromRotation(playerCar.rotation, currentSpeed, playerCar.body.velocity);

    // --- PLAYER LAP LOGIC ---
    if (playerCar.y < 350) checkpointReached = true;

    if (checkpointReached && playerCar.y > 700 && prevX > 730 && playerCar.x <= 730) {
        
        let thisLapTime = time - lapStartTime;
        if (thisLapTime < bestLapTime) {
            bestLapTime = thisLapTime;
            localStorage.setItem('f1_bestLap', bestLapTime);
            document.getElementById('best-lap').innerText = formatTime(bestLapTime);
        }
        lapStartTime = time; 

        laps++;
        checkpointReached = false;
        
        // SUDDEN DEATH: Player finishes first!
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