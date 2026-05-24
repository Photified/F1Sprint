// --- DEBUG SETTING ---
// Keep this TRUE to see the yellow string. Turn to FALSE when it looks perfect!
const SHOW_WAYPOINTS = true; 

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

let startTime = 0, laps = 1, maxLaps = 3;
let checkpointReached = false, raceFinished = false;

let lapStartTime = 0;
let bestLapTime = Infinity;
let bestRaceTime = Infinity;

let maskData = null; 
let prevX, prevY; 
let currentSpeed = 0;
let maxSpeed = 450; 

let mobileLeft = false, mobileRight = false, mobileGas = false, mobileBrake = false;

// --- FIXED CPU WAYPOINTS (The Racing Line) ---
// I mapped these strictly to the asphalt based on your screenshot!
const waypoints = [
    {x: 1200, y: 830}, // Before Start Line
    {x: 800, y: 830},  // Start line
    {x: 250, y: 830},  // End of bottom straight
    {x: 150, y: 720},  // Bottom left curve apex
    {x: 250, y: 600},  // Bottom left exit
    {x: 650, y: 600},  // Middle straight
    {x: 800, y: 480},  // Entering S-curve
    {x: 650, y: 380},  // Exiting S-curve
    {x: 250, y: 380},  // Top left straight
    {x: 150, y: 260},  // Top left hairpin apex
    {x: 250, y: 150},  // Top left exit
    {x: 1300, y: 150}, // End of top straight
    {x: 1450, y: 250}, // Top right curve apex
    {x: 1300, y: 380}, // Approaching chicane
    {x: 1050, y: 500}, // Chicane apex
    {x: 1250, y: 650}, // Chicane exit
    {x: 1450, y: 750}, // Bottom right curve apex
    {x: 1300, y: 830}  // Bottom right exit
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
    startTime = this.time.now;
    lapStartTime = startTime; 

    bestLapTime = parseFloat(localStorage.getItem('f1_bestLap')) || Infinity;
    bestRaceTime = parseFloat(localStorage.getItem('f1_bestRace')) || Infinity;
    
    document.getElementById('best-lap').innerText = formatTime(bestLapTime);
    document.getElementById('best-race').innerText = formatTime(bestRaceTime);

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    // --- DEV TOOL: CLICK TO GET COORDINATES ---
    this.input.on('pointerdown', function (pointer) {
        console.log(`Clicked X: ${Math.floor(pointer.x)}, Y: ${Math.floor(pointer.y)}`);
    });

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

    generateCarSprite(this, 'car-red', 0xe10600); 
    generateCarSprite(this, 'car-blue', 0x0055ff); 
    generateCarSprite(this, 'car-yellow', 0xffcc00); 

    cpuGroup = this.physics.add.group();
    
    let cpu1 = cpuGroup.create(930, 790, 'car-blue'); 
    cpu1.targetWP = 1; // Start aiming for waypoint 1
    cpu1.speed = 360;  

    let cpu2 = cpuGroup.create(1000, 835, 'car-yellow'); 
    cpu2.targetWP = 1;
    cpu2.speed = 340; 

    cpuGroup.children.iterate((cpu) => {
        cpu.setDepth(10);
        cpu.angle = 180;
        cpu.body.setCollideWorldBounds(true);
        cpu.body.setBounce(0.4); 
        cpu.body.setMass(1.5);   
    });

    playerCar = this.physics.add.sprite(930, 835, 'car-red');
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
}

function update(time) {
    if (raceFinished) {
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
        cpu.rotation = Phaser.Math.Angle.RotateTo(cpu.rotation, targetAngle, 0.05);
        this.physics.velocityFromRotation(cpu.rotation, cpu.speed, cpu.body.velocity);
    });

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
            raceFinished = true;
            document.getElementById('lap-counter').innerText = "FINISH";
            currentSpeed = 0;
            playerCar.body.setVelocity(0);
            
            let totalRaceTime = time - startTime;
            if (totalRaceTime < bestRaceTime) {
                bestRaceTime = totalRaceTime;
                localStorage.setItem('f1_bestRace', bestRaceTime);
                document.getElementById('best-race').innerText = formatTime(bestRaceTime);
            }

            document.getElementById('res-final').innerText = formatTime(totalRaceTime);
            document.getElementById('res-best').innerText = formatTime(bestLapTime);
            document.getElementById('results-modal').classList.add('show');
            
        } else {
            document.getElementById('lap-counter').innerText = laps;
        }
    }

    prevX = playerCar.x;
    prevY = playerCar.y;

    if (!raceFinished) {
        let elapsedTime = time - startTime;
        document.getElementById('timer-display').innerText = formatTime(elapsedTime);
    }
}