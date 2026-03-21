/**
 * CraneVehicle — A physics-based vehicle with a rope crane
 *
 * LEARN: The vehicle is a real Matter.js body that drives on the ground.
 * It has a crane arm (static relative to the vehicle) with a rope hanging
 * down. When the rope's hook touches a trash piece, pressing SPACE attaches
 * the piece to the hook. The vehicle then drives to a column and drops
 * the piece in.
 *
 * The vehicle is affected by physics — it drives OVER pieces on the ground,
 * bumping into and pushing them. But it CANNOT fall into columns (it drives
 * over the column openings on a bridge/rail at ground level).
 *
 * Controls:
 *   Arrow Left/Right: drive
 *   SPACE: grab piece touching hook / release carried piece
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../types';
import { type SpawnedPiece, getPieceData } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import {
  VEHICLE_WIDTH,
  VEHICLE_HEIGHT,
  VEHICLE_SPEED,
  LANDSCAPE_WIDTH,
} from '../config';
import { Terrain } from './Terrain';

/** Vehicle collision category — collides with ground and pieces, not column walls */
const VEHICLE_CATEGORY = 0x0010;

export class CraneVehicle {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  /** The vehicle chassis — dynamic body on the ground */
  private chassis: MatterJS.BodyType;

  /** Crane arm tip position (fixed offset from chassis) */
  private armTipX = 0;
  private armTipY = 0;

  /** Hook — small dynamic body dangling from the arm tip via rope */
  private hook: MatterJS.BodyType;
  private ropeConstraint!: MatterJS.ConstraintType;
  private ropeLength = 80; // Current rope length (adjustable)
  private readonly ROPE_MIN = 15;
  private readonly ROPE_MAX = 150;
  private readonly ROPE_SPEED = 2; // Pixels per frame when reeling
  private readonly ARM_HEIGHT = 70; // How tall the crane arm extends above chassis

  /** Carried piece — attached to hook via constraint */
  private carriedPiece: SpawnedPiece | null = null;
  private carriedBody: MatterJS.BodyType | null = null;
  private carryConstraint: MatterJS.ConstraintType | null = null;

  /** Input */
  private leftKey: Phaser.Input.Keyboard.Key | null = null;
  private rightKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;

  /** Column delivery zones */
  private columnZones: Array<{
    left: number; right: number;
    deliver: (piece: SpawnedPiece) => boolean;
  }> = [];


  constructor(scene: Phaser.Scene, _renderer: PieceRenderer, startX: number) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(12);

    const terrainY = Terrain.getHeightAt(startX);
    const chassisY = terrainY - VEHICLE_HEIGHT / 2 - 2;

    // Create chassis as a dynamic body
    this.chassis = scene.matter.add.rectangle(
      startX, chassisY, VEHICLE_WIDTH, VEHICLE_HEIGHT,
      {
        label: 'vehicle-chassis',
        friction: 0.8,
        frictionStatic: 1.0,
        frictionAir: 0.05,
        density: 0.01, // Heavy so pieces don't push it easily
        collisionFilter: {
          category: VEHICLE_CATEGORY,
          mask: 0x0001 | CollisionCategory.PIECE, // Ground + pieces
        },
      },
    );
    // Allow rotation but resist tipping (high but not infinite inertia)
    scene.matter.body.setInertia(this.chassis, 800);

    // Create hook — small circle dangling from arm
    const armTipStartY = chassisY - VEHICLE_HEIGHT / 2 - this.ARM_HEIGHT;
    this.hook = scene.matter.add.circle(
      startX, armTipStartY + this.ropeLength, 5,
      {
        label: 'vehicle-hook',
        density: 0.002,
        frictionAir: 0.03,
        collisionFilter: {
          category: VEHICLE_CATEGORY,
          mask: 0x0001, // Only collides with ground (not pieces — we check overlap manually)
        },
      },
    );

    // Rope from arm tip to hook — length is adjustable via up/down keys
    this.ropeConstraint = scene.matter.add.constraint(
      this.chassis,
      this.hook,
      this.ropeLength,
      0.7,
      {
        pointA: { x: 0, y: -(VEHICLE_HEIGHT / 2 + this.ARM_HEIGHT) },
        damping: 0.02,
        label: 'vehicle-rope',
      },
    );

    this.setupInput();
  }

  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
  }

  update(): void {
    this.handleDriving();
    this.handleRopeReel();
    this.handleAction();
    this.updateArmPosition();
    this.draw();
  }

  /**
   * Reel the rope in/out with up/down arrows.
   *
   * LEARN: We change the constraint's `length` property each frame.
   * Matter.js constraints are springs — shortening the length pulls
   * the hook (and any attached piece) upward. Lengthening lets it
   * drop down. This simulates a winch/reel on the crane arm.
   */
  private handleRopeReel(): void {
    if (!this.upKey || !this.downKey) return;

    if (this.upKey.isDown) {
      this.ropeLength = Math.max(this.ROPE_MIN, this.ropeLength - this.ROPE_SPEED);
    }
    if (this.downKey.isDown) {
      this.ropeLength = Math.min(this.ROPE_MAX, this.ropeLength + this.ROPE_SPEED);
    }

    // Update the constraint length
    this.ropeConstraint.length = this.ropeLength;
  }

  private handleDriving(): void {
    if (!this.leftKey || !this.rightKey) return;

    let force = 0;
    if (this.leftKey.isDown) force -= VEHICLE_SPEED * 0.001;
    if (this.rightKey.isDown) force += VEHICLE_SPEED * 0.001;

    if (force !== 0) {
      this.scene.matter.body.applyForce(this.chassis, this.chassis.position, { x: force, y: 0 });
    }

    // Clamp position
    const cx = this.chassis.position.x;
    if (cx < 40 || cx > LANDSCAPE_WIDTH - 40) {
      this.scene.matter.body.setVelocity(this.chassis, {
        x: 0,
        y: this.chassis.velocity.y,
      });
      this.scene.matter.body.setPosition(this.chassis, {
        x: Phaser.Math.Clamp(cx, 40, LANDSCAPE_WIDTH - 40),
        y: this.chassis.position.y,
      });
    }

    // Gentle rotation correction — vehicle tilts on slopes but doesn't flip
    // Apply a restoring torque proportional to current angle
    const angle = this.chassis.angle;
    if (Math.abs(angle) > 0.01) {
      this.scene.matter.body.setAngularVelocity(this.chassis,
        this.chassis.angularVelocity * 0.9 - angle * 0.05,
      );
    }

    // Prevent sinking below terrain
    const terrainY = Terrain.getHeightAt(this.chassis.position.x);
    const targetY = terrainY - VEHICLE_HEIGHT / 2 - 2;
    if (this.chassis.position.y > targetY + 5) {
      this.scene.matter.body.setPosition(this.chassis, {
        x: this.chassis.position.x,
        y: targetY,
      });
    }
  }

  private handleAction(): void {
    if (!this.spaceJustPressed) return;
    this.spaceJustPressed = false;

    const vx = this.chassis.position.x;

    if (!this.carriedPiece) {
      // Try to grab — find a piece body near the hook
      const hookPos = this.hook.position;
      const bodies = this.scene.matter.world.getAllBodies();
      let closest: MatterJS.BodyType | null = null;
      let closestDist = 40; // Max grab distance

      for (const body of bodies) {
        if (body.isStatic) continue;
        if (!body.label?.startsWith('piece-')) continue;
        if (body === this.hook || body === this.chassis) continue;

        const dx = body.position.x - hookPos.x;
        const dy = body.position.y - hookPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = body;
        }
      }

      if (closest) {
        // Resolve to parent for compound bodies
        const parent = (closest as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? closest;
        const data = getPieceData(parent);
        if (data) {
          this.carriedBody = parent;
          // Create a fake SpawnedPiece for the column delivery
          this.carriedPiece = {
            body: parent,
            definition: { name: data.name, vertices: data.originalVertices, color: data.color },
            materialKey: data.materialKey,
            material: data.material,
          };

          // Attach to hook
          this.carryConstraint = this.scene.matter.add.constraint(
            this.hook,
            parent,
            10, // Short
            0.7,
            { damping: 0.05, label: 'vehicle-carry' },
          );
        }
      }
    } else {
      // Try to deliver to a column
      const zone = this.columnZones.find(z => vx >= z.left && vx <= z.right);
      if (zone && this.carriedPiece) {
        // Release the constraint — piece falls into column
        if (this.carryConstraint) {
          this.scene.matter.world.removeConstraint(this.carryConstraint);
          this.carryConstraint = null;
        }
        zone.deliver(this.carriedPiece);
        this.carriedPiece = null;
        this.carriedBody = null;
      } else {
        // Just drop it on the ground
        if (this.carryConstraint) {
          this.scene.matter.world.removeConstraint(this.carryConstraint);
          this.carryConstraint = null;
        }
        this.carriedPiece = null;
        this.carriedBody = null;
      }
    }
  }

  private updateArmPosition(): void {
    // Track arm tip position (follows chassis, accounting for rotation)
    const cos = Math.cos(this.chassis.angle);
    const sin = Math.sin(this.chassis.angle);
    const offsetY = -(VEHICLE_HEIGHT / 2 + this.ARM_HEIGHT);
    this.armTipX = this.chassis.position.x + sin * -offsetY;
    this.armTipY = this.chassis.position.y + cos * offsetY;

    // Clamp hook inside landscape
    if (this.hook.position.x < 10 || this.hook.position.x > LANDSCAPE_WIDTH - 10) {
      this.scene.matter.body.setPosition(this.hook, {
        x: Phaser.Math.Clamp(this.hook.position.x, 10, LANDSCAPE_WIDTH - 10),
        y: this.hook.position.y,
      });
    }
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

  private draw(): void {
    this.graphics.clear();
    const cx = this.chassis.position.x;
    const cy = this.chassis.position.y;

    // Chassis
    this.graphics.fillStyle(0xaa8833);
    this.graphics.fillRect(
      cx - VEHICLE_WIDTH / 2, cy - VEHICLE_HEIGHT / 2,
      VEHICLE_WIDTH, VEHICLE_HEIGHT,
    );

    // Wheels
    this.graphics.fillStyle(0x333333);
    this.graphics.fillCircle(cx - VEHICLE_WIDTH / 3, cy + VEHICLE_HEIGHT / 2 - 2, 7);
    this.graphics.fillCircle(cx + VEHICLE_WIDTH / 3, cy + VEHICLE_HEIGHT / 2 - 2, 7);

    // Crane arm (vertical from chassis top)
    this.graphics.lineStyle(3, 0xaa8833, 0.9);
    this.graphics.lineBetween(cx, cy - VEHICLE_HEIGHT / 2, this.armTipX, this.armTipY);

    // Arm tip
    this.graphics.fillStyle(0xccaa44);
    this.graphics.fillRect(this.armTipX - 8, this.armTipY - 3, 16, 6);

    // Rope from arm tip to hook
    this.graphics.lineStyle(2, 0xcccccc, 0.6);
    this.graphics.lineBetween(
      this.armTipX, this.armTipY,
      this.hook.position.x, this.hook.position.y,
    );

    // Hook
    this.graphics.fillStyle(this.carriedPiece ? 0x44aa44 : 0xcccccc);
    this.graphics.fillCircle(this.hook.position.x, this.hook.position.y, 4);

    // Carry line from hook to piece
    if (this.carriedBody) {
      this.graphics.lineStyle(1.5, 0x44aa44, 0.4);
      this.graphics.lineBetween(
        this.hook.position.x, this.hook.position.y,
        this.carriedBody.position.x, this.carriedBody.position.y,
      );
    }
  }
}
