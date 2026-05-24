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

// --- WIDENED & CENTERED RACING LINE ---
const waypoints = [
    {x: 1200, y: 810}, {x: 800, y: 810}, {x: 350, y: 810}, {x: 200, y: 770}, 
    {x: 150, y: 700}, {x: 200, y: 620}, {x: 350, y: 590}, {x: 650, y: 590}, 
    {x: 750, y: 540}, {x: 750, y: 440}, {x: 650, y: 390}, {x: 350, y: 390}, 
    {x: 200, y: 350}, {x: 150, y: 260}, {x: 200, y: 170}, {x: 350, y: 140}, 
    {x: 1200, y: 140}, {x: 1350, y: 170}, {x: 1450, y: 260}, {x: 1350, y: 360}, 
    {x: 1250, y: 390}, {x: 1080, y: 420}, {x: 1020, y: 500}, {x: 1080, y: 580}, 
    {x: 1250, y: 610}, {x: 1400, y: 640}, {x: 1450, y: 740}, {x: 1350, y: 810}
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

    // GENERATE 8 CAR COLORS
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

    // --- ALIGNED 8-CAR GRID ---
    // Column 1 (Closest to line)
    spawnCPU(880, 760, 'car-blue', 400);   
    spawnCPU(880, 840, 'car-yellow', 390); 
    // Column 2
    spawnCPU(980, 760, 'car-green', 380);  
    spawnCPU(980, 840, 'car-purple', 370); 
    // Column 3
    spawnCPU(1080, 760, 'car-orange', 360); 
    spawnCPU(1080, 840, 'car-cyan', 350);   
    // Column 4 (Back row)
    spawnCPU(1180, 760, 'car-pink', 340);  

    // PLAYER - Grid 8 (Dead Last, bottom right box)
    playerCar = this.physics.add.sprite(1180, 840, 'car-red');
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
        
        if (dist < 80) {
            cpu.targetWP++;
            if (cpu.targetWP >= waypoints.length) cpu.targetWP = 0; 
            target = waypoints[cpu.targetWP];
        }

        let targetAngle = Phaser.Math.Angle.Between(cpu.x, cpu.y, target.x, target.y);
        
        // INCREASED AI STEERING SPEED: Now turns sharper to avoid outside walls!
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