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
        arcade: { debug: false } // No more purple boxes!
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let playerCar;
let cursors;

// Race state variables
let startTime = 0;
let laps = 0;
let maxLaps = 3;
let checkpointReached = false;
let raceFinished = false;
let startLineX = 725; 

// Mask variables
let maskCanvas;
let prevX, prevY; // Stores the car's last safe position

function preload() {
    // Make sure both of these exact files are uploaded to your GitHub!
    this.load.image('trackImg', 'track.png'); 
    this.load.image('maskImg', 'mask.png'); 
}

function create() {
    startTime = this.time.now;

    // 1. Draw the visual track
    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    // 2. Draw the hidden mask to a canvas we can read pixels from
    maskCanvas = this.textures.createCanvas('maskPixelMap', 1600, 900);
    let srcMask = this.textures.get('maskImg').getSourceImage();
    maskCanvas.context.drawImage(srcMask, 0, 0, 1600, 900);

    // ==========================================
    // THE CAR SPRITE (50% Scaled down)
    // ==========================================
    let carGen = this.make.graphics({ x: 0, y: 0, add: false });
    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(2, 0, 6, 4, 1);   
    carGen.fillRoundedRect(2, 16, 6, 4, 1);  
    carGen.fillRoundedRect(17, 0, 5, 3, 1);  
    carGen.fillRoundedRect(17, 17, 5, 3, 1); 
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(0, 4, 3, 12);
    carGen.fillStyle(0xe10600, 1);
    carGen.fillRect(3, 6, 15, 8); 
    carGen.fillRect(18, 8, 6, 4); 
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(22, 3, 3, 14);
    carGen.fillStyle(0xffffff, 1);
    carGen.fillCircle(11, 10, 2.5);
    carGen.generateTexture('f1-sprite', 25, 20);

    // ==========================================
    // SPAWN PLAYER ON THE GRID
    // ==========================================
    playerCar = this.physics.add.sprite(930, 835, 'f1-sprite');
    playerCar.setDepth(10); 
    playerCar.angle = 180; 
    playerCar.body.setCollideWorldBounds(true);
    
    // Initialize the safe spot
    prevX = playerCar.x;
    prevY = playerCar.y;

    cursors = this.input.keyboard.createCursorKeys();
}

function update(time) {
    if (raceFinished) return;

    // --- COLLISION MASK PIXEL DETECTION ---
    let pixel = new Phaser.Display.Color();
    try {
        // Read the pixel on the MASK exactly where the car is
        maskCanvas.getPixel(Math.floor(playerCar.x), Math.floor(playerCar.y), pixel);
        
        // 1. SAFE PIXEL (White or Transparent): Normal Asphalt
        if (pixel.a === 0 || (pixel.r > 200 && pixel.g > 200 && pixel.b > 200)) { 
            playerCar.body.setDrag(1500); 
            playerCar.body.setMaxVelocity(550);
            prevX = playerCar.x; // Save safe spot
            prevY = playerCar.y;
        }
        // 2. BLACK PIXEL: Solid Wall Hit
        else if (pixel.r < 50 && pixel.g < 50 && pixel.b < 50) { 
            // Teleport back to the last known safe spot
            playerCar.x = prevX;
            playerCar.y = prevY;
            // Bounce backwards slightly
            playerCar.body.velocity.x *= -0.5;
            playerCar.body.velocity.y *= -0.5;
        } 
        // 3. RED PIXEL: Grass / Dirt
        else if (pixel.r > 200 && pixel.g < 100 && pixel.b < 100) { 
            playerCar.body.setDrag(2500);
            playerCar.body.setMaxVelocity(120);
            prevX = playerCar.x; // Save safe spot
            prevY = playerCar.y;
        } 
        // 4. CATCH-ALL FAILSAFE (Treat as Asphalt)
        else {
            playerCar.body.setDrag(1500); 
            playerCar.body.setMaxVelocity(550);
            prevX = playerCar.x;
            prevY = playerCar.y;
        }
    } catch(e) {}

    // --- CONTROLS (HIGH GRIP SETUP) ---
    playerCar.body.setAngularVelocity(0);
    
    if (cursors.left.isDown) {
        playerCar.body.setAngularVelocity(-320);
    } else if (cursors.right.isDown) {
        playerCar.body.setAngularVelocity(320);
    }

    if (cursors.up.isDown) {
        this.physics.velocityFromRotation(playerCar.rotation, 2500, playerCar.body.acceleration);
    } else if (cursors.down.isDown) {
        this.physics.velocityFromRotation(playerCar.rotation, -1000, playerCar.body.acceleration);
    } else {
        playerCar.body.setAcceleration(0);
    }

    // --- LAP TRACKING ---
    if (playerCar.y < 350) checkpointReached = true;

    if (checkpointReached && playerCar.x <= 820 && playerCar.y > 720) {
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