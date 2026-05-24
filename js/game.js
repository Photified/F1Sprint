// --- EASY SETTINGS ---
// Change this to 'true' if you want to see the wall hitboxes to fine-tune them!
const SHOW_WALL_HITBOXES = false; 

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
            debug: SHOW_WALL_HITBOXES 
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
let startLineX = 725; 
let trackTextureCanvas;

function preload() {
    this.load.image('trackImg', 'track.png'); 
}

function create() {
    startTime = this.time.now;

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    trackTextureCanvas = this.textures.createCanvas('trackPixelMap', 1600, 900);
    let srcImg = this.textures.get('trackImg').getSourceImage();
    trackTextureCanvas.context.drawImage(srcImg, 0, 0, 1600, 900);

    // ==========================================
    // 1. SOLID COLLISION WALLS (Armco & Tires)
    // ==========================================
    trackWalls = this.physics.add.staticGroup();
    
    // I mapped these to the physical barriers in your image.
    // If they are slightly off, set SHOW_WALL_HITBOXES = true at the top to see and adjust them!
    const wallData = [
        // Outer Screen Edges (Failsafe)
        { x: 800, y: -25, w: 1600, h: 50 }, 
        { x: 800, y: 925, w: 1600, h: 50 }, 
        { x: -25, y: 450, w: 50, h: 900 },  
        { x: 1625, y: 450, w: 50, h: 900 },
        
        // Top Grandstand Barrier
        { x: 800, y: 130, w: 1400, h: 30 },
        
        // Bottom Straight Barrier
        { x: 800, y: 880, w: 1400, h: 30 },

        // Middle Horizontal Armco Barriers
        { x: 450, y: 645, w: 600, h: 25 }, // Bottom left straight
        { x: 350, y: 460, w: 400, h: 25 }, // Middle left straight
        
        // Major Tire Stacks (Approximations)
        { x: 130, y: 480, w: 40, h: 100 },  // Far left hairpin tires
        { x: 1480, y: 780, w: 40, h: 150 }, // Bottom right hairpin tires
        { x: 1150, y: 350, w: 150, h: 80 }, // Top right chicane tires
        { x: 670, y: 550, w: 50, h: 50 }    // Center kink tires
    ];

    wallData.forEach(wall => {
        let hitbox = this.add.rectangle(wall.x, wall.y, wall.w, wall.h, 0x000000, 0); 
        this.physics.add.existing(hitbox, true); 
        trackWalls.add(hitbox);
    });

    // ==========================================
    // 2. THE CAR SPRITE (50% SMALLER)
    // ==========================================
    let carGen = this.make.graphics({ x: 0, y: 0, add: false });
    
    // Tires (Black)
    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(2, 0, 6, 4, 1);   // Rear Left
    carGen.fillRoundedRect(2, 16, 6, 4, 1);  // Rear Right
    carGen.fillRoundedRect(17, 0, 5, 3, 1);  // Front Left
    carGen.fillRoundedRect(17, 17, 5, 3, 1); // Front Right
    
    // Rear Wing (Black)
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(0, 4, 3, 12);
    
    // Main Body & Nose (Red)
    carGen.fillStyle(0xe10600, 1);
    carGen.fillRect(3, 6, 15, 8); 
    carGen.fillRect(18, 8, 6, 4); 
    
    // Front Wing (Black)
    carGen.fillStyle(0x222222, 1);
    carGen.fillRect(22, 3, 3, 14);
    
    // Helmet (White)
    carGen.fillStyle(0xffffff, 1);
    carGen.fillCircle(11, 10, 2.5);
    
    // Generates a 25x20 sprite (Exactly half of the old 50x40)
    carGen.generateTexture('f1-sprite', 25, 20);

    // ==========================================
    // 3. SPAWN PLAYER
    // ==========================================
    playerCar = this.physics.add.sprite(930, 835, 'f1-sprite');
    playerCar.setDepth(10); 
    playerCar.angle = 180; 
    
    // Bounce physics when hitting the physical walls
    playerCar.body.setBounce(0.5); 
    playerCar.body.setCollideWorldBounds(true);
    this.physics.add.collider(playerCar, trackWalls);
    
    cursors = this.input.keyboard.createCursorKeys();
}

function update(time) {
    if (raceFinished) return;

    // --- TERRAIN GRASS/DIRT DETECTION ---
    let pixel = new Phaser.Display.Color();
    try {
        trackTextureCanvas.getPixel(Math.floor(playerCar.x), Math.floor(playerCar.y), pixel);
        
        if (pixel.g > 100 || (pixel.r > 150 && pixel.g > 120)) {
            // 🚨 ON GRASS/DIRT: Extreme drag, car bogs down instantly
            playerCar.body.setDrag(2500);
            playerCar.body.setMaxVelocity(120);
        } else {
            // 🏁 ON ASPHALT: Grippy F1 Physics
            // High drag kills sideways sliding, high velocity allows speed
            playerCar.body.setDrag(1500); 
            playerCar.body.setMaxVelocity(550);
        }
    } catch(e) {}

    // --- CONTROLS (HIGH GRIP SETUP) ---
    playerCar.body.setAngularVelocity(0);
    
    if (cursors.left.isDown) {
        playerCar.body.setAngularVelocity(-320); // Snappier steering
    } else if (cursors.right.isDown) {
        playerCar.body.setAngularVelocity(320);
    }

    if (cursors.up.isDown) {
        // Extreme acceleration overcomes the high drag instantly, pulling the car forward instead of sliding
        this.physics.velocityFromRotation(playerCar.rotation, 2500, playerCar.body.acceleration);
    } else if (cursors.down.isDown) {
        // Strong Brakes
        this.physics.velocityFromRotation(playerCar.rotation, -1000, playerCar.body.acceleration);
    } else {
        playerCar.body.setAcceleration(0);
    }

    // --- LAP TRACKING LOGIC ---
    if (playerCar.y < 350) {
        checkpointReached = true;
    }

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