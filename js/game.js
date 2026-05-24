// Game Configuration
const config = {
    type: Phaser.AUTO,
    width: 800,       // Fixed width for our single-screen track
    height: 600,      // Fixed height
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false // Change to true if you want to see collision boxes
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Global variables
let playerCar;
let cursors;

// 1. PRELOAD
// We aren't loading external images yet, but this is where you'd load your sprites later!
function preload() {
    // Example: this.load.image('f1-car', 'assets/car.png');
}

// 2. CREATE
// This runs once when the game starts. We set up the track, the car, and the controls.
function create() {
    // --- DRAWING THE TRACK ---
    const graphics = this.add.graphics();

    // Grass background
    graphics.fillStyle(0x2d6a4f, 1);
    graphics.fillRect(0, 0, 800, 600);

    // Outer Asphalt Track
    graphics.fillStyle(0x333333, 1);
    graphics.fillRoundedRect(50, 50, 700, 500, 150);

    // Inner Grass Infield
    graphics.fillStyle(0x2d6a4f, 1);
    graphics.fillRoundedRect(200, 150, 400, 300, 75);

    // Start/Finish Line
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(390, 50, 10, 100);

    // --- CREATING THE PLAYER CAR ---
    // We use a simple 30x15 red rectangle to represent the F1 car for now
    playerCar = this.add.rectangle(400, 100, 30, 15, 0xe10600);
    this.physics.add.existing(playerCar);

    // --- ARCADE PHYSICS CONFIGURATION ---
    // This creates the Super Sprint "Drift" feel
    playerCar.body.setMaxVelocity(400); // Top speed
    playerCar.body.setDrag(150);        // Friction/Grass resistance when off the gas
    playerCar.body.setBounce(0.5);      // Bounciness if we hit a wall
    playerCar.body.setCollideWorldBounds(true); // Don't let the car leave the screen

    // --- CONTROLS ---
    cursors = this.input.keyboard.createCursorKeys();
}

// 3. UPDATE
// This runs 60 times a second. We handle steering and acceleration here.
function update() {
    // Stop rotating by default
    playerCar.body.setAngularVelocity(0);

    // Steering
    if (cursors.left.isDown) {
        playerCar.body.setAngularVelocity(-250); // Turn left
    } else if (cursors.right.isDown) {
        playerCar.body.setAngularVelocity(250);  // Turn right
    }

    // Acceleration (Gas Pedal)
    if (cursors.up.isDown) {
        // By applying acceleration rather than direct velocity, the car carries 
        // its old momentum into corners, creating a drifting/sliding effect!
        this.physics.velocityFromRotation(playerCar.rotation, 600, playerCar.body.acceleration);
    } else {
        // Coasting
        playerCar.body.setAcceleration(0);
    }
}