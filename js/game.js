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
            debug: false // Turned off! No more confusing purple boxes.
        }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let playerCar;
let cursors;
let trackWalls;

let startTime = 0;
let laps = 0;
let maxLaps = 3;
let checkpointReached = false;
let raceFinished = false;
let trackTextureCanvas;

function preload() {
    this.load.image('trackImg', 'track.png'); 
}

function create() {
    startTime = this.time.now;

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    // Pixel reader for the grass
    trackTextureCanvas = this.textures.createCanvas('trackPixelMap', 1600, 900);
    let srcImg = this.textures.get('trackImg').getSourceImage();
    trackTextureCanvas.context.drawImage(srcImg, 0, 0, 1600, 900);

    // ==========================================
    // 1. OUTER BOUNDARIES (Keeps you on screen)
    // ==========================================
    trackWalls = this.physics.add.staticGroup();
    const wallData = [
        { x: 800, y: -25, w: 1600, h: 50 }, 
        { x: 800, y: 925, w: 1600, h: 50 }, 
        { x: -25, y: 450, w: 50, h: 900 },  
        { x: 1625, y: 450, w: 50, h: 900 }
    ];
    wallData.forEach(wall => {
        let hitbox = this.add.rectangle(wall.x, wall.y, wall.w, wall.h, 0x000000, 0); 
        this.physics.add.existing(hitbox, true); 
        trackWalls.add(hitbox);
    });

    // ==========================================
    // 2. THE CAR SPRITE
    // ==========================================
    let carGen = this.make.graphics({ x: 0, y: 0, add: false });
    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(4, 0, 12, 8, 2);   
    carGen.fillRoundedRect(4, 32, 12, 8, 2);  
    carGen.fillRoundedRect(34, 0, 10, 6, 2);  
    carGen.fillRoundedRect(34, 34, 10, 6, 2); 
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(0, 8, 6, 24);
    carGen.fillStyle(0xe10600, 1);
    carGen.fillRect(6, 12, 30, 16); 
    carGen.fillRect(36, 16, 12, 8);
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(45, 6, 5, 28);
    carGen.fillStyle(0xffffff, 1);
    carGen.fillCircle(22, 20, 5);
    carGen.generateTexture('f1-sprite', 50, 40);

    // ==========================================
    // 3. SPAWN PLAYER ON THE GRID
    // ==========================================
    // Spawns perfectly on the bottom-right grid slot facing left
    playerCar = this.physics.add.sprite(950, 835, 'f1-sprite');
    playerCar.setDepth(10); 
    playerCar.angle = 180; 
    playerCar.body.setBounce(0.4); 
    playerCar.body.setCollideWorldBounds(true);
    
    this.physics.add.collider(playerCar, trackWalls);
    cursors = this.input.keyboard.createCursorKeys();
}

function update(time) {
    if (raceFinished) return;

    // --- TERRAIN PIXEL DETECTION ---
    let pixel = new Phaser.Display.Color();
    try {
        trackTextureCanvas.getPixel(Math.floor(playerCar.x), Math.floor(playerCar.y), pixel);
        
        // If the pixel is green (grass) or brownish (dirt)
        if (pixel.g > 100 || (pixel.r > 150 && pixel.g > 120)) {
            // OFF TRACK: Massive penalty, car bogs down
            playerCar.body.setDrag(1200);
            playerCar.body.setMaxVelocity(150);
        } else {
            // ON ASPHALT: Fast arcade racing
            playerCar.body.setDrag(150);
            playerCar.body.setMaxVelocity(600);
        }
    } catch(e) {}

    // --- CONTROLS ---
    playerCar.body.setAngularVelocity(0);
    
    if (cursors.left.isDown) {
        playerCar.body.setAngularVelocity(-260);
    } else if (cursors.right.isDown) {
        playerCar.body.setAngularVelocity(260);
    }

    if (cursors.up.isDown) {
        this.physics.velocityFromRotation(playerCar.rotation, 900, playerCar.body.acceleration);
    } else if (cursors.down.isDown) {
        this.physics.velocityFromRotation(playerCar.rotation, -400, playerCar.body.acceleration);
    } else {
        playerCar.body.setAcceleration(0);
    }

    // --- LAP TRACKING LOGIC ---
    // 1. Must drive to the top half of the track to hit the hidden checkpoint
    if (playerCar.y < 350) {
        checkpointReached = true;
    }

    // 2. Must cross the checkered line (around X: 820, Y: > 720) with the checkpoint triggered
    if (checkpointReached && playerCar.x <= 820 && playerCar.y > 720) {
        laps++;
        checkpointReached = false; // Reset so it doesn't double-count
        
        if (laps > maxLaps) {
            raceFinished = true;
            document.getElementById('lap-counter').innerText = "FINISH";
            playerCar.body.setAcceleration(0);
            playerCar.body.setVelocity(0);
        } else {
            document.getElementById('lap-counter').innerText = laps;
        }
    }

    // --- TIMER LOGIC ---
    if (!raceFinished) {
        let elapsedTime = time - startTime;
        let minutes = Math.floor(elapsedTime / 60000);
        let seconds = Math.floor((elapsedTime % 60000) / 1000);
        let ms = Math.floor((elapsedTime % 1000));
        
        let formattedTime = 
            (minutes < 10 ? '0' : '') + minutes + ':' + 
            (seconds < 10 ? '0' : '') + seconds + '.' + 
            (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
        
        document.getElementById('timer-display').innerText = formattedTime;
    }
}