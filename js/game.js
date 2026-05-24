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
let cursors;

let startTime = 0, laps = 0, maxLaps = 3;
let checkpointReached = false, raceFinished = false;

// Mask variables
let maskData = null; // Holds the raw pixel array of your mask.png
let prevX, prevY; // Stores the car's last safe position

// Mobile control states
let mobileLeft = false, mobileRight = false, mobileGas = false, mobileBrake = false;

function preload() {
    this.load.image('trackImg', 'track.png'); 
    this.load.image('maskImg', 'mask.png'); 
}

function create() {
    startTime = this.time.now;

    // 1. Draw the visual track
    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    // 2. THE FIX: Vanilla HTML5 Canvas Pixel Extraction
    // This perfectly extracts your Red, Black, and White pixels into a massive array
    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 900;
    let ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    
    let srcMask = this.textures.get('maskImg').getSourceImage();
    ctx.drawImage(srcMask, 0, 0, 1600, 900);
    maskData = ctx.getImageData(0, 0, 1600, 900).data;

    // 3. DRAW CAR (50% Scaled down)
    let carGen = this.make.graphics({ x: 0, y: 0, add: false });
    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(2, 0, 6, 4, 1); carGen.fillRoundedRect(2, 16, 6, 4, 1);  
    carGen.fillRoundedRect(17, 0, 5, 3, 1); carGen.fillRoundedRect(17, 17, 5, 3, 1); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(0, 4, 3, 12);
    carGen.fillStyle(0xe10600, 1); carGen.fillRect(3, 6, 15, 8); carGen.fillRect(18, 8, 6, 4); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(22, 3, 3, 14);
    carGen.fillStyle(0xffffff, 1); carGen.fillCircle(11, 10, 2.5);
    carGen.generateTexture('f1-sprite', 25, 20);

    // 4. SPAWN PLAYER
    playerCar = this.physics.add.sprite(930, 835, 'f1-sprite');
    playerCar.setDepth(10); 
    playerCar.angle = 180; 
    playerCar.body.setCollideWorldBounds(true);
    
    prevX = playerCar.x; 
    prevY = playerCar.y;

    cursors = this.input.keyboard.createCursorKeys();

    // 5. BIND MOBILE CONTROLS (Requires the HTML/CSS from the previous message!)
    const bindBtn = (id, keydown, keyup) => {
        const btn = document.getElementById(id);
        if(!btn) return; // Skips if you haven't added the HTML buttons yet
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
    if (raceFinished) return;

    // --- MASK PIXEL DETECTION ---
    let x = Math.floor(playerCar.x);
    let y = Math.floor(playerCar.y);

    // Make sure we only check pixels inside the screen
    if (maskData && x >= 0 && x < 1600 && y >= 0 && y < 900) {
        // Find the specific pixel in the massive array
        let index = (y * 1600 + x) * 4;
        let r = maskData[index];
        let g = maskData[index + 1];
        let b = maskData[index + 2];
        let a = maskData[index + 3];

        if (a === 0) {
            // Failsafe: If pixel is transparent, assume safe asphalt
            playerCar.body.setDrag(1500); 
            playerCar.body.setMaxVelocity(550);
            prevX = playerCar.x; prevY = playerCar.y;
        } 
        else if (r < 100 && g < 100 && b < 100) {
            // ⬛ BLACK PIXEL (WALL HIT)
            // Teleport back to safe spot and bounce
            playerCar.x = prevX;
            playerCar.y = prevY;
            playerCar.body.velocity.x *= -0.5;
            playerCar.body.velocity.y *= -0.5;
        } 
        else if (r > 100 && g < 100 && b < 100) {
            // 🟥 RED PIXEL (GRASS/DIRT)
            // Massive drag, slow speed
            playerCar.body.setDrag(2500);
            playerCar.body.setMaxVelocity(120);
            prevX = playerCar.x; prevY = playerCar.y;
        } 
        else {
            // ⬜ WHITE PIXEL (ASPHALT)
            // Fast F1 Grip
            playerCar.body.setDrag(1500); 
            playerCar.body.setMaxVelocity(550);
            prevX = playerCar.x; prevY = playerCar.y;
        }
    }

    // --- CONTROLS ---
    playerCar.body.setAngularVelocity(0);
    
    if (cursors.left.isDown || mobileLeft) playerCar.body.setAngularVelocity(-320);
    else if (cursors.right.isDown || mobileRight) playerCar.body.setAngularVelocity(320);

    if (cursors.up.isDown || mobileGas) {
        this.physics.velocityFromRotation(playerCar.rotation, 2500, playerCar.body.acceleration);
    } else if (cursors.down.isDown || mobileBrake) {
        this.physics.velocityFromRotation(playerCar.rotation, -1000, playerCar.body.acceleration);
    } else {
        playerCar.body.setAcceleration(0);
    }

    // --- LAP TRACKING ---
    // 1. Must pass the top half of the track
    if (playerCar.y < 450) checkpointReached = true;

    // 2. Must cross the bottom straight going left
    if (checkpointReached && playerCar.x <= 850 && playerCar.y > 700) {
        laps++;
        checkpointReached = false;
        if (laps > maxLaps) {
            raceFinished = true;
            document.getElementById('lap-counter').innerText = "FINISH";
            playerCar.body.setAcceleration(0);
            playerCar.body.setVelocity(0);
        } else {
            document.getElementById('lap-counter').innerText = laps;
        }
    }

    // --- TIMER ---
    if (!raceFinished) {
        let elapsedTime = time - startTime;
        let minutes = Math.floor(elapsedTime / 60000);
        let seconds = Math.floor((elapsedTime % 60000) / 1000);
        let ms = Math.floor((elapsedTime % 1000));
        document.getElementById('timer-display').innerText = 
            (minutes < 10 ? '0' : '') + minutes + ':' + 
            (seconds < 10 ? '0' : '') + seconds + '.' + 
            (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
    }
}