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

let maskData = null; 
let prevX, prevY; 

// Mobile control states
let mobileLeft = false, mobileRight = false, mobileGas = false, mobileBrake = false;

function preload() {
    this.load.image('trackImg', 'track.png'); 
    this.load.image('maskImg', 'mask.png'); 
}

function create() {
    startTime = this.time.now;

    const bg = this.add.image(800, 450, 'trackImg');
    bg.setDisplaySize(1600, 900); 
    
    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600;
    offscreenCanvas.height = 900;
    let ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    
    let srcMask = this.textures.get('maskImg').getSourceImage();
    ctx.drawImage(srcMask, 0, 0, 1600, 900);
    maskData = ctx.getImageData(0, 0, 1600, 900).data;

    let carGen = this.make.graphics({ x: 0, y: 0, add: false });
    carGen.fillStyle(0x111111, 1);
    carGen.fillRoundedRect(2, 0, 6, 4, 1); carGen.fillRoundedRect(2, 16, 6, 4, 1);  
    carGen.fillRoundedRect(17, 0, 5, 3, 1); carGen.fillRoundedRect(17, 17, 5, 3, 1); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(0, 4, 3, 12);
    carGen.fillStyle(0xe10600, 1); carGen.fillRect(3, 6, 15, 8); carGen.fillRect(18, 8, 6, 4); 
    carGen.fillStyle(0x222222, 1); carGen.fillRect(22, 3, 3, 14);
    carGen.fillStyle(0xffffff, 1); carGen.fillCircle(11, 10, 2.5);
    carGen.generateTexture('f1-sprite', 25, 20);

    playerCar = this.physics.add.sprite(930, 835, 'f1-sprite');
    playerCar.setDepth(10); 
    playerCar.angle = 180; 
    playerCar.body.setCollideWorldBounds(true);
    
    prevX = playerCar.x; 
    prevY = playerCar.y;

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
    if (raceFinished) return;

    let x = Math.floor(playerCar.x);
    let y = Math.floor(playerCar.y);

    if (maskData && x >= 0 && x < 1600 && y >= 0 && y < 900) {
        let index = (y * 1600 + x) * 4;
        let r = maskData[index];
        let g = maskData[index + 1];
        let b = maskData[index + 2];
        let a = maskData[index + 3];

        if (a === 0) {
            playerCar.body.setDrag(800); 
            playerCar.body.setMaxVelocity(350); 
            prevX = playerCar.x; prevY = playerCar.y;
        } 
        else if (r < 100 && g < 100 && b < 100) {
            playerCar.x = prevX;
            playerCar.y = prevY;
            playerCar.body.velocity.x *= -0.5;
            playerCar.body.velocity.y *= -0.5;
        } 
        else if (r > 100 && g < 100 && b < 100) {
            playerCar.body.setDrag(2500);
            playerCar.body.setMaxVelocity(80); 
            prevX = playerCar.x; prevY = playerCar.y;
        } 
        else {
            playerCar.body.setDrag(800); 
            playerCar.body.setMaxVelocity(350); 
            prevX = playerCar.x; prevY = playerCar.y;
        }
    }

    // --- CONTROLS ---
    playerCar.body.setAngularVelocity(0);
    
    if (cursors.left.isDown || mobileLeft) playerCar.body.setAngularVelocity(-200);
    else if (cursors.right.isDown || mobileRight) playerCar.body.setAngularVelocity(200);

    if (cursors.up.isDown || mobileGas) {
        this.physics.velocityFromRotation(playerCar.rotation, 1200, playerCar.body.acceleration);
    } else if (cursors.down.isDown || mobileBrake) {
        this.physics.velocityFromRotation(playerCar.rotation, -800, playerCar.body.acceleration);
    } else {
        playerCar.body.setAcceleration(0);
    }

    if (playerCar.y < 450) checkpointReached = true;

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