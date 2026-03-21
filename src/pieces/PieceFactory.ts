/**
 * PieceFactory — Creates physics bodies from piece definitions + materials
 *
 * LEARN: A "factory" in game dev is a function or class that creates game
 * objects. Instead of constructing pieces inline, we centralize creation here.
 * This ensures every piece is created consistently (correct physics settings,
 * collision filters, graphics) and makes it easy to change how pieces are
 * built without touching every place that spawns one.
 *
 * Each piece gets a random MATERIAL from tuning.json that determines its
 * physics properties (density, friction, bounciness) and how it behaves
 * on the crane (rope stiffness/damping). Heavy materials like lead barely
 * swing, while light ones like aluminum arc wildly.
 */
import Phaser from 'phaser';
import { PieceDefinition, MaterialDefinition, CollisionCategory } from '../types';
import { PIECE_DEFINITIONS } from './PieceDefinitions';
import { TUNING, rollMaterial, getMaterial } from '../tuning';

/** Data we attach to each piece body for later use */
export interface PieceUserData {
  name: string;
  color: number;
  originalVertices: number[];
  settled: boolean;
  /** Material key (e.g., "aluminum", "steel", "lead") */
  materialKey: string;
  /** Full material properties — used by CraneSystem for rope tuning */
  material: MaterialDefinition;
  /** Timestamp when this body was created — used for shatter immunity */
  createdAt: number;
}

/** Result of creating a piece — includes the body and its material info */
export interface SpawnedPiece {
  body: MatterJS.BodyType;
  definition: PieceDefinition;
  materialKey: string;
  material: MaterialDefinition;
}

export class PieceFactory {
  private scene: Phaser.Scene;

  /**
   * LEARN: "Bag randomization" is the standard Tetris algorithm.
   * Instead of purely random pieces (which can give you 5 S-blocks in a row),
   * you shuffle all 7 pieces into a "bag" and deal them one at a time.
   * When the bag is empty, you create a new shuffled bag. This guarantees
   * you see every piece type within every 7 pieces — much fairer.
   */
  private bag: PieceDefinition[] = [];

  /** Dev overrides — when set, the next spawn uses these instead of random */
  private forcedShape: string | null = null;
  private forcedMaterial: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Force the next spawned piece to use a specific shape */
  setForcedShape(shapeName: string | null): void {
    this.forcedShape = shapeName;
  }

  /** Force the next spawned piece to use a specific material */
  setForcedMaterial(materialKey: string | null): void {
    this.forcedMaterial = materialKey;
  }

  getForcedShape(): string | null { return this.forcedShape; }
  getForcedMaterial(): string | null { return this.forcedMaterial; }

  /** Get the next piece definition (using bag randomization) */
  nextDefinition(): PieceDefinition {
    if (this.bag.length === 0) {
      this.bag = Phaser.Utils.Array.Shuffle([...PIECE_DEFINITIONS]);
    }
    return this.bag.pop()!;
  }

  /** Peek at what the next piece will be (for preview) without consuming it */
  peekNext(): PieceDefinition {
    if (this.bag.length === 0) {
      this.bag = Phaser.Utils.Array.Shuffle([...PIECE_DEFINITIONS]);
    }
    return this.bag[this.bag.length - 1];
  }

  /**
   * Create a full piece: picks a random material, creates the physics body,
   * and returns everything the game needs. Respects dev console overrides.
   */
  spawnPiece(x: number, y: number): SpawnedPiece {
    // Use forced shape or random
    let def: PieceDefinition;
    if (this.forcedShape) {
      def = PIECE_DEFINITIONS.find(d => d.name === this.forcedShape) ?? this.nextDefinition();
    } else {
      def = this.nextDefinition();
    }

    // Use forced material or random
    let materialKey: string;
    let material: MaterialDefinition;
    if (this.forcedMaterial) {
      materialKey = this.forcedMaterial;
      material = getMaterial(this.forcedMaterial);
    } else {
      ({ key: materialKey, material } = rollMaterial());
    }

    const body = this.createBody(def, material, materialKey, x, y);
    return { body, definition: def, materialKey, material };
  }

  /**
   * Create a Matter.js body from a piece definition + material.
   *
   * LEARN: The material determines the physics "feel":
   * - density: How heavy (affects inertia, which affects swing amplitude)
   * - restitution: Bounciness on collision (rubber bounces, lead doesn't)
   * - friction: How much pieces grip each other and walls
   * - frictionStatic: Grip when not moving (prevents slow sliding)
   *
   * These come from tuning.json, so you can adjust the feel of each
   * material without touching code.
   */
  private createBody(
    def: PieceDefinition,
    material: MaterialDefinition,
    materialKey: string,
    x: number,
    y: number,
  ): MatterJS.BodyType {
    const scale = TUNING.pieces.scale;

    // Convert flat vertex array to Phaser-style {x, y} points
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < def.vertices.length; i += 2) {
      points.push({
        x: def.vertices[i] * scale,
        y: def.vertices[i + 1] * scale,
      });
    }

    const body = this.scene.matter.add.fromVertices(
      x,
      y,
      [points],
      {
        label: `piece-${def.name}`,
        restitution: material.restitution,
        friction: material.friction,
        frictionStatic: material.frictionStatic,
        frictionAir: material.frictionAir ?? 0.01,
        density: material.density,
        collisionFilter: {
          category: CollisionCategory.PIECE,
          mask: CollisionCategory.WALL | CollisionCategory.PIECE,
        },
      },
      true,
    );

    /**
     * LEARN: We attach the material data directly to the body so other
     * systems (CraneSystem, PieceRenderer) can read it without needing
     * a lookup table. When the crane attaches this piece, it reads
     * material.ropeStiffness and material.ropeDamping to configure
     * the rope constraint — making heavy pieces swing less.
     */
    (body as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
      name: def.name,
      color: def.color,
      originalVertices: def.vertices,
      settled: false,
      materialKey,
      material,
      createdAt: Date.now(),
    };

    return body;
  }
}

/**
 * Helper to get game data from a piece body.
 *
 * LEARN: For compound bodies (concave shapes decomposed by poly-decomp),
 * Matter.js fires collision events for the individual SUB-PARTS, not
 * the parent body. But gameData is only on the parent. So we check
 * the body first, then walk up to body.parent if needed. Without this,
 * T-Block, S-Block, Z-Block, L-Block, and J-Block would never trigger
 * special material handlers because their sub-parts have no gameData.
 */
export function getPieceData(body: MatterJS.BodyType): PieceUserData | undefined {
  const data = (body as MatterJS.BodyType & { gameData?: PieceUserData }).gameData;
  if (data) return data;
  // Check parent for compound bodies
  const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent;
  if (parent && parent !== body) {
    return (parent as MatterJS.BodyType & { gameData?: PieceUserData }).gameData;
  }
  return undefined;
}
