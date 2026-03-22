/**
 * BulldozerVehicle — Tracked bulldozer with front-mounted blade
 *
 * LEARN: A real bulldozer (like a CAT D6) is NOTHING like a crane. It has:
 * - Wide caterpillar/crawler TRACKS (not wheels) — two continuous belts
 *   of linked metal plates that spread the vehicle's weight over a large
 *   area, giving incredible traction on soft/uneven ground
 * - A LOW-SLUNG rectangular cab — much lower than a crane cab because
 *   there's no boom to see over, and low = stable
 * - A large curved BLADE at the FRONT, mounted on two hydraulic push arms
 *   that connect to the track frame. The blade is as wide as or wider
 *   than the tracks
 * - Very low center of gravity — the engine, transmission, and blade
 *   weight are all low, making it nearly impossible to tip over
 * - The blade raises/lowers via hydraulic arms. When lowered, the bottom
 *   cutting edge scrapes the ground. When raised, material slides off
 *
 * Controls (DIFFERENT from crane vehicles):
 *   ← →        : Drive (tracks, not wheels)
 *   ↑ ↓        : Raise / lower blade
 *   SPACE       : Quick blade slam (raises then drops for impact)
 *
 * No boom, no rope, no hook. The bulldozer pushes things with its blade
 * by driving into them. The blade can also scoop and lift small pieces.
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../../types';
import { type SpawnedPiece } from '../../pieces/PieceFactory';
import {
  VEHICLE_SPEED,
  LANDSCAPE_WIDTH,
} from '../../config';
import { Terrain } from '../Terrain';
import { TouchControls } from '../../ui/TouchControls';
import { type Vehicle, type ColumnZone } from './Vehicle';

const VEHICLE_CATEGORY = 0x0010;

/**
 * LEARN: Bulldozer dimensions — wider and lower than a crane.
 * Real bulldozer proportions: a CAT D6 is ~3.9m wide, ~3.2m long,
 * and only ~3.1m tall (to top of cab). The blade adds another 0.5m
 * to the front. We scale this proportionally for our game.
 */
const DOZER_WIDTH = 90;
const DOZER_HEIGHT = 24;
const CAB_WIDTH = 36;
const CAB_HEIGHT = 22;
const TRACK_WIDTH = 90;
const TRACK_HEIGHT = 18;
const TRACK_WHEEL_RADIUS = 9;
const TRACK_WHEEL_COUNT = 5;

/**
 * LEARN: The blade dimensions — wider than the vehicle body.
 * A real D6 blade is ~3.5m wide on a 2.4m wide chassis.
 * The blade is tall (to push piles) but the cutting edge at the
 * bottom is what contacts the ground.
 */
const BLADE_HEIGHT = 40;
const BLADE_CURVE_DEPTH = 14;
const ARM_LENGTH = 30;

export class BulldozerVehicle implements Vehicle {
  readonly type = 'bulldozer';
  readonly displayName = 'Bulldozer';
  readonly icon = '🚜';

  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  /** Vehicle parts — tracks instead of wheels */
  private chassis: MatterJS.BodyType;
  private trackWheelsFront: MatterJS.BodyType;
  private trackWheelsRear: MatterJS.BodyType;

  /**
   * LEARN: The blade is a physics body that collides with pieces.
   * Unlike the crane's hook (which passes through pieces), the blade
   * needs to PUSH pieces. It's connected to the chassis via a constraint
   * with variable length (simulating hydraulic raise/lower).
   */
  private blade: MatterJS.BodyType;
  private bladeConstraintLeft: MatterJS.ConstraintType;
  private bladeConstraintRight: MatterJS.ConstraintType;

  /** Blade hydraulics */
  private bladeHeight = 0;
  private readonly BLADE_MIN_HEIGHT = -10;
  private readonly BLADE_MAX_HEIGHT = 25;
  private readonly BLADE_SPEED = 0.8;
  private slamming = false;
  private slamTimer = 0;

  /** Input */
  private leftKey: Phaser.Input.Keyboard.Key | null = null;
  private rightKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;
  private touchControls: TouchControls;

  /** Column zones */
  private columnZones: ColumnZone[] = [];

  /** HUD */
  private vehicleLabel: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, startX: number, touchControls: TouchControls) {
    this.scene = scene;
    this.touchControls = touchControls;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(12);

    const terrainY = Terrain.getHeightAt(startX);
    const collisionMask = 0x0001 | CollisionCategory.PIECE | 0x0020;

    /**
     * LEARN: The bulldozer chassis sits LOW — the tracks are the lowest
     * point and the chassis barely rises above them. This gives a very
     * low center of gravity, making the bulldozer stable and hard to tip.
     * Compare to the crane where the chassis is raised above the wheels.
     */
    const chassisY = terrainY - TRACK_HEIGHT - DOZER_HEIGHT / 2;

    // Main chassis — wide and flat
    this.chassis = scene.matter.add.rectangle(
      startX, chassisY, DOZER_WIDTH, DOZER_HEIGHT,
      {
        label: 'vehicle-chassis',
        friction: 0.8, frictionStatic: 1.2, frictionAir: 0.04,
        density: 0.015,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    /**
     * LEARN: Real bulldozer tracks have many small road wheels (bogies)
     * along the bottom. We simulate this with just two physics circles
     * at front and rear — they act like wheels but we DRAW them as tracks.
     * More circles = smoother ride over terrain but more physics cost.
     * Two is enough for gameplay.
     */
    const wheelY = terrainY - TRACK_WHEEL_RADIUS;
    this.trackWheelsRear = scene.matter.add.circle(
      startX - DOZER_WIDTH / 2.5, wheelY, TRACK_WHEEL_RADIUS,
      {
        label: 'vehicle-track-wheel',
        friction: 2.0, frictionStatic: 3.0, density: 0.008,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );
    this.trackWheelsFront = scene.matter.add.circle(
      startX + DOZER_WIDTH / 2.5, wheelY, TRACK_WHEEL_RADIUS,
      {
        label: 'vehicle-track-wheel',
        friction: 2.0, frictionStatic: 3.0, density: 0.008,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Track axle constraints
    scene.matter.add.constraint(this.chassis, this.trackWheelsRear, 0, 0.6, {
      pointA: { x: -DOZER_WIDTH / 2.5, y: DOZER_HEIGHT / 2 },
      damping: 0.02, label: 'track-axle-rear',
    });
    scene.matter.add.constraint(this.chassis, this.trackWheelsFront, 0, 0.6, {
      pointA: { x: DOZER_WIDTH / 2.5, y: DOZER_HEIGHT / 2 },
      damping: 0.02, label: 'track-axle-front',
    });

    /**
     * LEARN: The blade is a separate physics body that collides with pieces.
     * It's connected to the chassis via two constraints (simulating the
     * two hydraulic push arms). The constraint length changes to raise/lower
     * the blade. The blade is wider than the chassis so it pushes everything
     * in front, even things wider than the vehicle.
     */
    const bladeX = startX + DOZER_WIDTH / 2 + ARM_LENGTH;
    const bladeY = chassisY + DOZER_HEIGHT / 2 - 5;
    this.blade = scene.matter.add.rectangle(
      bladeX, bladeY, 8, BLADE_HEIGHT,
      {
        label: 'vehicle-blade',
        friction: 0.6, frictionStatic: 1.0, density: 0.012,
        collisionFilter: { category: VEHICLE_CATEGORY, mask: collisionMask },
      },
    );

    // Two hydraulic arm constraints (left/right of center)
    this.bladeConstraintLeft = scene.matter.add.constraint(
      this.chassis, this.blade, ARM_LENGTH, 0.8,
      {
        pointA: { x: DOZER_WIDTH / 2, y: -5 },
        pointB: { x: 0, y: -BLADE_HEIGHT / 3 },
        damping: 0.05, label: 'blade-arm-left',
      },
    );
    this.bladeConstraintRight = scene.matter.add.constraint(
      this.chassis, this.blade, ARM_LENGTH, 0.8,
      {
        pointA: { x: DOZER_WIDTH / 2, y: 8 },
        pointB: { x: 0, y: BLADE_HEIGHT / 3 },
        damping: 0.05, label: 'blade-arm-right',
      },
    );

    // Vehicle label
    this.vehicleLabel = scene.add.text(10, 10, `${this.icon} ${this.displayName}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);

    this.setupInput();
  }

  getPosition(): { x: number; y: number } {
    return { x: this.chassis.position.x, y: this.chassis.position.y };
  }

  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
  }

  update(): void {
    const touch = this.touchControls.getState();
    this.handleDriving(touch);
    this.handleBlade(touch);
    this.handleSlam(touch);
    this.updateBladePosition();
    this.draw();
  }

  destroy(): void {
    const bodies = [this.chassis, this.trackWheelsFront, this.trackWheelsRear, this.blade];
    for (const body of bodies) {
      this.scene.matter.world.remove(body);
    }
    this.graphics.destroy();
    if (this.vehicleLabel) this.vehicleLabel.destroy();
  }

  /**
   * LEARN: Bulldozer tracks provide much more traction than wheels.
   * In real life, a bulldozer can push enormous loads without its
   * tracks slipping. We simulate this with higher friction values
   * and slightly more drive force than the crane wheels.
   */
  private handleDriving(touch: { driveLeft: boolean; driveRight: boolean }): void {
    const speed = VEHICLE_SPEED * 0.1;
    const left = this.leftKey?.isDown || touch.driveLeft;
    const right = this.rightKey?.isDown || touch.driveRight;

    if (left) {
      this.scene.matter.body.setAngularVelocity(this.trackWheelsRear, -speed);
      this.scene.matter.body.setAngularVelocity(this.trackWheelsFront, -speed);
      // Apply direct force to chassis — the heavy blade adds drag that
      // angular velocity on the track wheels alone can't overcome
      this.scene.matter.body.applyForce(this.chassis, this.chassis.position, { x: -0.008, y: 0 });
    } else if (right) {
      this.scene.matter.body.setAngularVelocity(this.trackWheelsRear, speed);
      this.scene.matter.body.setAngularVelocity(this.trackWheelsFront, speed);
      this.scene.matter.body.applyForce(this.chassis, this.chassis.position, { x: 0.008, y: 0 });
    }

    const cx = this.chassis.position.x;
    if (cx < 40 || cx > LANDSCAPE_WIDTH - 40) {
      this.scene.matter.body.setPosition(this.chassis, {
        x: Phaser.Math.Clamp(cx, 40, LANDSCAPE_WIDTH - 40),
        y: this.chassis.position.y,
      });
    }
  }

  /**
   * LEARN: ↑↓ raises and lowers the blade by changing the constraint
   * lengths. Short constraints = blade raised. Long constraints = blade
   * lowered to ground level. This mimics hydraulic cylinder extension.
   */
  private handleBlade(touch: { boomUp: boolean; boomDown: boolean }): void {
    if (this.slamming) return;

    const up = this.upKey?.isDown || touch.boomUp;
    const down = this.downKey?.isDown || touch.boomDown;

    if (up) this.bladeHeight = Math.min(this.BLADE_MAX_HEIGHT, this.bladeHeight + this.BLADE_SPEED);
    if (down) this.bladeHeight = Math.max(this.BLADE_MIN_HEIGHT, this.bladeHeight - this.BLADE_SPEED);
  }

  /**
   * LEARN: The blade slam is a quick raise-then-drop motion. Useful
   * for compacting piles or dislodging stuck pieces. The blade raises
   * quickly, then drops under gravity + hydraulic force for impact.
   */
  private handleSlam(touch: { grab: boolean }): void {
    const actionPressed = this.spaceJustPressed || touch.grab;
    this.spaceJustPressed = false;

    if (actionPressed && !this.slamming) {
      this.slamming = true;
      this.slamTimer = 20;
      this.bladeHeight = this.BLADE_MAX_HEIGHT;
    }

    if (this.slamming) {
      this.slamTimer--;
      if (this.slamTimer <= 0) {
        this.bladeHeight = this.BLADE_MIN_HEIGHT;
        this.slamming = false;
      }
    }
  }

  /**
   * LEARN: The blade position is updated by adjusting constraint lengths.
   * When bladeHeight increases, the constraints get shorter (pulling the
   * blade up). When it decreases, they get longer (letting the blade drop).
   * The pointA on the chassis stays fixed — only the effective distance
   * changes, just like a real hydraulic cylinder extending/retracting.
   */
  private updateBladePosition(): void {
    const baseLen = ARM_LENGTH;
    const heightOffset = this.bladeHeight * 0.4;
    this.bladeConstraintLeft.length = baseLen - heightOffset;
    this.bladeConstraintRight.length = baseLen - heightOffset;
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;
    this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => { this.spaceJustPressed = true; });
  }

  /**
   * LEARN: Drawing a bulldozer is completely different from a crane.
   * We draw from bottom to top: tracks, chassis frame, cab, exhaust stack,
   * then the blade and hydraulic arms at the front. Every part is positioned
   * relative to the chassis body, rotated by the chassis angle.
   */
  private draw(): void {
    this.graphics.clear();
    const cx = this.chassis.position.x;
    const cy = this.chassis.position.y;
    const angle = this.chassis.angle;

    this.graphics.save();
    this.graphics.translateCanvas(cx, cy);
    this.graphics.rotateCanvas(angle);

    // === CATERPILLAR TRACKS ===
    /**
     * LEARN: Real caterpillar tracks are continuous loops of linked metal
     * plates (called "shoes") that wrap around drive sprockets and idlers.
     * We draw them as a rounded rectangle outline with evenly-spaced
     * tread marks (vertical lines) to show the individual track shoes.
     * The tracks are the WIDEST part of the bulldozer.
     */
    const trackY = DOZER_HEIGHT / 2 - 2;

    // Left track
    this.drawTrack(-TRACK_WIDTH / 2 + 2, trackY, TRACK_WIDTH - 4, TRACK_HEIGHT);

    // === CHASSIS FRAME ===
    /**
     * LEARN: The bulldozer chassis (also called the "mainframe") is a
     * heavy steel box that sits between the tracks. It houses the engine,
     * transmission, and hydraulic pumps. We draw it as a flat, wide
     * rectangle — much wider and lower than a crane chassis.
     */
    this.graphics.fillStyle(0xcc9922);
    this.graphics.fillRect(-DOZER_WIDTH / 2, -DOZER_HEIGHT / 2, DOZER_WIDTH, DOZER_HEIGHT);

    // Engine bay detail — dark panel on the rear half
    this.graphics.fillStyle(0xaa7711);
    this.graphics.fillRect(-DOZER_WIDTH / 2, -DOZER_HEIGHT / 2 + 2, DOZER_WIDTH * 0.35, DOZER_HEIGHT - 4);

    // Engine grille — horizontal slits
    this.graphics.lineStyle(1, 0x886611, 0.7);
    for (let i = 0; i < 3; i++) {
      const grillY = -DOZER_HEIGHT / 2 + 6 + i * 6;
      this.graphics.lineBetween(
        -DOZER_WIDTH / 2 + 4, grillY,
        -DOZER_WIDTH / 2 + DOZER_WIDTH * 0.3, grillY,
      );
    }

    // === CAB ===
    /**
     * LEARN: The bulldozer cab is a low-profile box with protective
     * ROPS (Roll-Over Protective Structure). It sits toward the rear
     * of the chassis, offset from center. Real dozer cabs have very
     * limited visibility forward — the operator looks over the engine
     * bay and blade. The cab is much smaller than you'd expect.
     */
    const cabX = -DOZER_WIDTH / 2 + DOZER_WIDTH * 0.35;
    const cabY = -DOZER_HEIGHT / 2 - CAB_HEIGHT;

    // Cab body
    this.graphics.fillStyle(0xddaa33);
    this.graphics.fillRect(cabX, cabY, CAB_WIDTH, CAB_HEIGHT);

    // Cab roof (ROPS frame — slightly wider than cab)
    this.graphics.fillStyle(0xbb8822);
    this.graphics.fillRect(cabX - 2, cabY - 3, CAB_WIDTH + 4, 4);

    // Cab window — dark glass
    this.graphics.fillStyle(0x223344, 0.8);
    this.graphics.fillRect(cabX + 3, cabY + 3, CAB_WIDTH - 6, CAB_HEIGHT * 0.55);

    // Window frame
    this.graphics.lineStyle(1, 0x998822, 0.9);
    this.graphics.strokeRect(cabX + 3, cabY + 3, CAB_WIDTH - 6, CAB_HEIGHT * 0.55);

    // ROPS pillars (vertical bars at corners)
    this.graphics.lineStyle(2.5, 0x997711, 1);
    this.graphics.lineBetween(cabX + 1, cabY, cabX + 1, cabY + CAB_HEIGHT);
    this.graphics.lineBetween(cabX + CAB_WIDTH - 1, cabY, cabX + CAB_WIDTH - 1, cabY + CAB_HEIGHT);

    // === EXHAUST STACK ===
    /**
     * LEARN: Many bulldozers have a vertical exhaust pipe (stack) behind
     * the cab. It's tall and thin, with a rain cap on top. Modern dozers
     * sometimes have it integrated, but the classic look has a visible stack.
     */
    const stackX = cabX - 5;
    const stackH = 16;
    this.graphics.fillStyle(0x555555);
    this.graphics.fillRect(stackX, cabY - stackH, 4, stackH);
    // Rain cap
    this.graphics.fillStyle(0x444444);
    this.graphics.fillRect(stackX - 1, cabY - stackH - 2, 6, 3);

    // === HYDRAULIC PUSH ARMS ===
    /**
     * LEARN: The blade is connected to the track frame by two heavy
     * push arms (also called "C-frame" or "straight blade arms").
     * They extend forward from the sides of the chassis to the blade.
     * Hydraulic cylinders mounted on top of the arms control raise/lower.
     */
    const armStartX = DOZER_WIDTH / 2 - 5;
    const armEndX = DOZER_WIDTH / 2 + ARM_LENGTH - 5;
    const armUpperY = -8 - this.bladeHeight * 0.3;
    const armLowerY = 5 - this.bladeHeight * 0.3;

    // Push arms — thick steel beams
    this.graphics.lineStyle(4.5, 0x997711, 0.95);
    this.graphics.lineBetween(armStartX, -4, armEndX, armUpperY);
    this.graphics.lineBetween(armStartX, 6, armEndX, armLowerY);

    // Hydraulic cylinders — angled between chassis and arms
    this.graphics.lineStyle(3, 0x666666, 0.9);
    this.graphics.lineBetween(armStartX - 8, -DOZER_HEIGHT / 2, armEndX - 8, armUpperY + 2);
    // Piston rod (chrome)
    this.graphics.lineStyle(1.5, 0xbbbbbb, 0.8);
    this.graphics.lineBetween(armStartX - 8, -DOZER_HEIGHT / 2, armEndX - 8, armUpperY + 2);

    // Arm pivot bolts
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(armStartX, -4, 2.5);
    this.graphics.fillCircle(armStartX, 6, 2.5);
    this.graphics.fillCircle(armEndX, armUpperY, 2.5);
    this.graphics.fillCircle(armEndX, armLowerY, 2.5);

    // === CURVED BLADE ===
    this.drawBlade(armEndX, (armUpperY + armLowerY) / 2);

    this.graphics.restore();

    /**
     * LEARN: After restoring the canvas transform, we draw track wheels
     * at their actual physics positions (world coordinates, not local).
     * The track treads above were drawn in local space, but the contact
     * wheels are physics bodies that rotate and bounce independently.
     */
    // Track wheel hubs (at physics positions)
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(this.trackWheelsRear.position.x, this.trackWheelsRear.position.y, TRACK_WHEEL_RADIUS - 2);
    this.graphics.fillCircle(this.trackWheelsFront.position.x, this.trackWheelsFront.position.y, TRACK_WHEEL_RADIUS - 2);
    this.graphics.fillStyle(0x666666);
    this.graphics.fillCircle(this.trackWheelsRear.position.x, this.trackWheelsRear.position.y, 3);
    this.graphics.fillCircle(this.trackWheelsFront.position.x, this.trackWheelsFront.position.y, 3);
  }

  /**
   * LEARN: Drawing caterpillar tracks. Real tracks are continuous loops
   * with individual "shoes" (the flat plates that contact the ground).
   * We draw:
   * 1. A filled rounded rectangle for the track belt
   * 2. Small road wheels (bogies) along the bottom
   * 3. A drive sprocket at the rear and an idler at the front
   * 4. Vertical tread lines to show individual track shoes
   */
  private drawTrack(x: number, y: number, width: number, height: number): void {
    // Track belt — dark rubber/steel
    this.graphics.fillStyle(0x2a2a2a);
    this.graphics.fillRoundedRect(x, y, width, height, 6);

    // Track edge highlight
    this.graphics.lineStyle(1, 0x3a3a3a, 0.8);
    this.graphics.strokeRoundedRect(x, y, width, height, 6);

    // Tread marks — vertical lines showing individual track shoes
    this.graphics.lineStyle(1, 0x383838, 0.6);
    const shoeWidth = 6;
    for (let sx = x + 5; sx < x + width - 3; sx += shoeWidth) {
      this.graphics.lineBetween(sx, y + 2, sx, y + height - 2);
    }

    // Road wheels (small bogies along the bottom of the track)
    this.graphics.fillStyle(0x444444);
    const bogieSpacing = width / (TRACK_WHEEL_COUNT + 1);
    for (let i = 1; i <= TRACK_WHEEL_COUNT; i++) {
      const bx = x + i * bogieSpacing;
      const by = y + height - 3;
      this.graphics.fillCircle(bx, by, 4);
      this.graphics.fillStyle(0x555555);
      this.graphics.fillCircle(bx, by, 2);
      this.graphics.fillStyle(0x444444);
    }

    // Drive sprocket (rear, larger)
    this.graphics.fillStyle(0x4a4a4a);
    this.graphics.fillCircle(x + 8, y + height / 2, 7);
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(x + 8, y + height / 2, 3);

    // Idler wheel (front, slightly smaller)
    this.graphics.fillStyle(0x4a4a4a);
    this.graphics.fillCircle(x + width - 8, y + height / 2, 6);
    this.graphics.fillStyle(0x555555);
    this.graphics.fillCircle(x + width - 8, y + height / 2, 2.5);
  }

  /**
   * LEARN: The bulldozer blade is a large C-shaped (concave) steel plate.
   * The concavity cups forward to contain the pushed material. The blade
   * has a hardened cutting edge at the bottom and reinforcement ribs on
   * the back. We draw it as a filled polygon with a curved front face.
   *
   * Real blade types:
   * - Straight blade (S-blade): flat, for fine grading
   * - Universal blade (U-blade): curved with wings, for moving loose material
   * - Semi-U blade (SU-blade): moderate curve, general purpose
   * We draw a U-blade style for maximum visual impact.
   */
  private drawBlade(centerX: number, centerY: number): void {
    const halfH = BLADE_HEIGHT / 2;
    const bladeColor = 0xddaa33;

    // Generate C-curve points (the blade face)
    const outerPts: Array<{ x: number; y: number }> = [];
    const innerPts: Array<{ x: number; y: number }> = [];
    const segments = 14;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const localY = -halfH + t * BLADE_HEIGHT;

      // Parabolic curve — deepest at center, curving INWARD to scoop.
      // Negative curveX makes the blade concave on the front (+X) side,
      // so it cups forward and scoops pieces as the bulldozer pushes.
      const curveFactor = 1 - Math.pow(2 * t - 1, 2);
      const curveX = -BLADE_CURVE_DEPTH * curveFactor;

      outerPts.push({ x: centerX + curveX + 6, y: centerY + localY });
      innerPts.push({ x: centerX + curveX, y: centerY + localY });
    }

    // Fill blade as closed polygon
    this.graphics.fillStyle(bladeColor, 0.95);
    this.graphics.beginPath();
    this.graphics.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
      this.graphics.lineTo(outerPts[i].x, outerPts[i].y);
    }
    this.graphics.lineTo(innerPts[innerPts.length - 1].x, innerPts[innerPts.length - 1].y);
    for (let i = innerPts.length - 2; i >= 0; i--) {
      this.graphics.lineTo(innerPts[i].x, innerPts[i].y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();

    // Front face highlight (the scooping edge)
    this.graphics.lineStyle(2.5, 0xffdd55, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
      this.graphics.lineTo(outerPts[i].x, outerPts[i].y);
    }
    this.graphics.strokePath();

    // Back face (inner edge)
    this.graphics.lineStyle(1.5, 0x886611, 0.7);
    this.graphics.beginPath();
    this.graphics.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) {
      this.graphics.lineTo(innerPts[i].x, innerPts[i].y);
    }
    this.graphics.strokePath();

    // Reinforcement ribs on the back
    this.graphics.lineStyle(1.5, 0x776611, 0.6);
    for (let r = 1; r <= 3; r++) {
      const ribIdx = Math.floor((r / 4) * segments);
      const outer = outerPts[ribIdx];
      const inner = innerPts[ribIdx];
      const ribX = inner.x - (outer.x - inner.x) * 0.8;
      const ribY = inner.y - (outer.y - inner.y) * 0.8;
      this.graphics.lineBetween(inner.x, inner.y, ribX, ribY);
    }

    // Cutting edge — hardened steel at bottom
    const bottomOuter = outerPts[outerPts.length - 1];
    const bottomInner = innerPts[innerPts.length - 1];
    const topOuter = outerPts[0];
    const topInner = innerPts[0];
    this.graphics.lineStyle(2, 0xeecc44, 0.9);
    this.graphics.lineBetween(bottomOuter.x, bottomOuter.y, bottomInner.x, bottomInner.y);
    this.graphics.lineBetween(topOuter.x, topOuter.y, topInner.x, topInner.y);

    // Wing tips — U-blade has small wings at the edges that curve forward
    this.graphics.fillStyle(0xcc9922, 0.9);
    // Top wing
    this.graphics.fillTriangle(
      outerPts[0].x, outerPts[0].y,
      outerPts[0].x + 6, outerPts[0].y - 4,
      outerPts[0].x - 2, outerPts[0].y - 3,
    );
    // Bottom wing
    this.graphics.fillTriangle(
      outerPts[outerPts.length - 1].x, outerPts[outerPts.length - 1].y,
      outerPts[outerPts.length - 1].x + 6, outerPts[outerPts.length - 1].y + 4,
      outerPts[outerPts.length - 1].x - 2, outerPts[outerPts.length - 1].y + 3,
    );
  }
}
