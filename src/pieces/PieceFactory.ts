/**
 * PieceFactory — Creates physics bodies and graphics from piece definitions
 *
 * LEARN: A "factory" in game dev is a function or class that creates game
 * objects. Instead of constructing pieces inline, we centralize creation here.
 * This ensures every piece is created consistently (correct physics settings,
 * collision filters, graphics) and makes it easy to change how pieces are
 * built without touching every place that spawns one.
 *
 * Matter.js creates bodies from vertex arrays. For concave shapes (like T
 * and L blocks), it auto-decomposes them into convex sub-parts internally.
 * We store the original vertices on the body for rendering and future slicing.
 */
import Phaser from 'phaser';
import { PieceDefinition, CollisionCategory } from '../types';
import { PIECE_SCALE } from '../config';
import { PIECE_DEFINITIONS } from './PieceDefinitions';

/** Data we attach to each piece body for later use */
export interface PieceUserData {
  name: string;
  color: number;
  originalVertices: number[];
  settled: boolean;
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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

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
   * Create a Matter.js body from a piece definition.
   *
   * LEARN: Matter.Bodies.fromVertices() takes an array of {x, y} points
   * and creates a rigid body. If the shape is concave, Matter auto-splits
   * it into convex sub-bodies (compound body). The body's position is its
   * center of mass, not the first vertex.
   *
   * We scale the vertices by PIECE_SCALE to convert from our small
   * definition coordinates (like [-2, -0.5, 2, -0.5, ...]) to actual
   * pixel sizes on screen.
   */
  createBody(
    def: PieceDefinition,
    x: number,
    y: number,
  ): MatterJS.BodyType {
    // Convert flat vertex array to Phaser-style {x, y} points
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < def.vertices.length; i += 2) {
      points.push({
        x: def.vertices[i] * PIECE_SCALE,
        y: def.vertices[i + 1] * PIECE_SCALE,
      });
    }

    // Create the physics body from vertices
    const body = this.scene.matter.add.fromVertices(
      x,
      y,
      [points],
      {
        label: `piece-${def.name}`,
        restitution: 0.1,   // Low bounce — pieces shouldn't be super bouncy
        friction: 0.6,       // Moderate friction so pieces grip each other
        frictionStatic: 0.8, // Higher static friction prevents sliding
        density: 0.002,      // Moderate density
        collisionFilter: {
          category: CollisionCategory.PIECE,
          mask: CollisionCategory.WALL | CollisionCategory.PIECE,
        },
      },
      true, // Remove collinear points for cleaner geometry
    );

    /**
     * LEARN: "User data" (or "plugin data" in Matter.js) is a way to attach
     * custom information to a physics body. The physics engine ignores it,
     * but our game code can read it. We store the piece name, color, and
     * original vertices here so the rendering system and future slicing
     * system can access them without a separate lookup table.
     */
    (body as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
      name: def.name,
      color: def.color,
      originalVertices: def.vertices,
      settled: false,
    };

    return body;
  }
}

/** Helper to get game data from a piece body */
export function getPieceData(body: MatterJS.BodyType): PieceUserData | undefined {
  return (body as MatterJS.BodyType & { gameData?: PieceUserData }).gameData;
}
