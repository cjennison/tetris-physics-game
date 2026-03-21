/**
 * PieceDefinitions — Vertex data for all TRASH piece shapes
 *
 * LEARN: In physics-based games, shapes are defined as vertex arrays.
 * Unlike grid-based Tetris where pieces are 4 squares, here each piece
 * is a polygon. Matter.js needs vertices to create physics bodies.
 *
 * Vertices are in LOCAL coordinates (centered around 0,0) and scaled
 * by PIECE_SCALE when spawned. Winding is counter-clockwise (required by PolyK).
 */
import { PieceDefinition } from '../types';

/**
 * Standard Tetromino-inspired shapes, but as continuous polygons.
 * Each shape approximates the classic Tetris piece but as a solid polygon
 * rather than 4 discrete squares.
 */
export const PIECE_DEFINITIONS: PieceDefinition[] = [
  {
    name: 'I-Block',
    // Long horizontal bar (4x1)
    vertices: [-2, -0.5, 2, -0.5, 2, 0.5, -2, 0.5],
    color: 0x00f0f0,
  },
  {
    name: 'O-Block',
    // Square (2x2)
    vertices: [-1, -1, 1, -1, 1, 1, -1, 1],
    color: 0xf0f000,
  },
  {
    name: 'T-Block',
    // T-shape
    vertices: [-1.5, -0.5, -0.5, -0.5, -0.5, -1.5, 0.5, -1.5, 0.5, -0.5, 1.5, -0.5, 1.5, 0.5, -1.5, 0.5],
    color: 0xa000f0,
  },
  {
    name: 'S-Block',
    // S-shape (zigzag)
    vertices: [-1.5, 0, -1.5, -1, -0.5, -1, -0.5, -2, 0.5, -2, 0.5, -1, 1.5, -1, 1.5, 0],
    color: 0x00f000,
  },
  {
    name: 'Z-Block',
    // Z-shape (reverse zigzag)
    vertices: [-1.5, -2, -1.5, -1, -0.5, -1, -0.5, 0, 0.5, 0, 0.5, -1, 1.5, -1, 1.5, -2],
    color: 0xf00000,
  },
  {
    name: 'L-Block',
    // L-shape
    vertices: [-1, -1.5, 0, -1.5, 0, -0.5, 1, -0.5, 1, 0.5, -1, 0.5],
    color: 0xf0a000,
  },
  {
    name: 'J-Block',
    // J-shape (reverse L)
    vertices: [0, -1.5, 1, -1.5, 1, 0.5, -1, 0.5, -1, -0.5, 0, -0.5],
    color: 0x0000f0,
  },
];
