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

// --- PERFECTED RACING LINE (Mapped directly to your yellow line) ---
const waypoints = [

  // START / MAIN STRAIGHT
  {x: 1320, y: 790},
  {x: 1120, y: 790},
  {x: 920, y: 790},
  {x: 720, y: 790},
  {x: 520, y: 790},
  {x: 320, y: 785},

  // BOTTOM LEFT HAIRPIN
  {x: 210, y: 760},
  {x: 135, y: 705},
  {x: 110, y: 635},
  {x: 145, y: 565},
  {x: 245, y: 520},

  // LEFT SIDE SWEEP
  {x: 410, y: 500},
  {x: 560, y: 500},
  {x: 670, y: 485},

  // CENTER LEFT S CURVE
  {x: 735, y: 450},
  {x: 760, y: 395},
  {x: 725, y: 340},

  // TOP LEFT ENTRY
  {x: 620, y: 305},
  {x: 470, y: 300},
  {x: 315, y: 300},

  // TOP LEFT HAIRPIN
  {x: 205, y: 275},
  {x: 135, y: 225},
  {x: 120, y: 160},
  {x: 170, y: 105},
  {x: 285, y: 80},

  // TOP STRAIGHT
  {x: 500, y: 75},
  {x: 760, y: 75},
  {x: 1030, y: 80},
  {x: 1280, y: 85},

  // TOP RIGHT HAIRPIN
  {x: 1410, y: 120},
  {x: 1490, y: 190},
  {x: 1510, y: 270},
  {x: 1480, y: 345},
  {x: 1395, y: 400},

  // RIGHT SIDE INNER SECTION
  {x: 1260, y: 425},
  {x: 1140, y: 445},
  {x: 1065, y: 490},
  {x: 1045, y: 555},
  {x: 1110, y: 610},

  // EXITING INNER SECTION
  {x: 1240, y: 645},
  {x: 1380, y: 670},

  // FINAL HAIRPIN
  {x: 1480, y: 705},
  {x: 1510, y: 765},
  {x: 1460, y: 820},
  {x: 1320, y: 790}

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
        cpu.targetWP = 2; // Point them towards turn 1
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

    // PLAYER - Grid 8 (Dead Last)
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
        let dist = Phaser.Math.Distance.Between(cpu.x, cpu.y, target.x, target.y);
        
        // INCREASED DETECTION RADIUS: Ensures they never miss a point and drive backward
        if (dist < 90) {
            cpu.targetWP++;
            if (cpu.targetWP >= waypoints.length) cpu.targetWP = 0; 
            target = waypoints[cpu.targetWP];
        }

        let targetAngle = Phaser.Math.Angle.Between(cpu.x, cpu.y, target.x, target.y);
        
        // Slightly smoother steering
        cpu.rotation = Phaser.Math.Angle.RotateTo(cpu.rotation, targetAngle, 0.15);
        this.physics.velocityFromRotation(cpu.rotation, cpu.speed, cpu.body.velocity);

        if (cpu.y < 350) cpu.checkpointReached = true;

        if (cpu.checkpointReached && cpu.y > 700 && cpu.prevX > 730 && cpu.x <= 730) {
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