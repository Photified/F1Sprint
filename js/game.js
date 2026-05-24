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
            // Purple debug boxes are ON
            debug: true 
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
    // Make sure this matches your file name exactly (case-sensitive on GitHub!)
    this.load.image('trackImg', 'track.jpg'); 
}

function create() {
    startTime = this.time.now;

    // Center the background image
    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    // CRITICAL FIX: Safe way to read the image pixels without crashing the browser
    trackTextureCanvas = this.textures.createCanvas('trackPixelMap', 1600, 900);
    let srcImg = this.textures.get('trackImg').getSourceImage();
    trackTextureCanvas.context.drawImage(srcImg, 0, 0, 1600, 900);

    // ==========================================
    // 1. INVISIBLE PHYSICS WALLS
    // ==========================================
    trackWalls = this.physics.add.staticGroup();

    const wallData = [
        // Outer Screen Edges
        { x: 800, y: -25, w: 1600, h: 50 }, 
        { x: 800, y: 925, w: 1600, h: 50 }, 
        { x: -25, y: 450, w: 50, h: 900 },  
        { x: 1625, y: 450, w: 50, h: 900 }, 

        // Inner Islands (Tweak these numbers!)
        { x: 400, y: 550, w: 550, h: 100 }, 
        { x: 1200, y: 400, w: 550, h: 150 },
        { x: 800, y: 250, w: 400, h: 150 }, 
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
    // Adjusted to spawn at the bottom grid, facing LEFT
    playerCar = this.physics.add.sprite(820, 810, 'f1-sprite');
    playerCar.angle = 180; 
    playerCar.body.setBounce(0.4); 
    playerCar.body.setCollideWorldBounds(true);
    
    this.physics.add.collider(playerCar, trackWalls);
    cursors = this.input.keyboard.createCursorKeys();
}

function update(time) {
    if (raceFinished) return;

    // --- TERRAIN PIXEL DETECTION (Grass & Dirt) ---
    let pixel = new Phaser.Display.Color();
    try {
        trackTextureCanvas.getPixel(Math.floor(playerCar.x), Math.floor(playerCar.y), pixel);
        
        if (pixel.g > 100 || (pixel.r > 150 && pixel.g > 120)) {
            // OFF TRACK
            playerCar.body.setDrag(800);
            playerCar.body.setMaxVelocity(250);
        } else {
            // ON ASPHALT
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
    if (playerCar.y < 350) {
        checkpointReached = true;
    }

    if (checkpointReached && playerCar.x < startLineX && playerCar.x > startLineX - 20 && playerCar.y > 650) {
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