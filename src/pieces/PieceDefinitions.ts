/**
 * PieceDefinitions — Vertex data for all TRASH piece shapes
 *
 * LEARN: Each shape is defined as a polygon outline in local coordinates.
 * 1 unit = 1 cell. Shapes are scaled by PIECE_SCALE (25px) when spawned.
 *
 * These match the classic Tetris tetromino layouts but as continuous
 * polygons for physics. Each shape traces the OUTLINE of the cells
 * that make up the piece, counter-clockwise.
 *
 * Visual reference (each # is one cell):
 *
 * I-Block:  ####          O-Block:  ##
 *                                   ##
 *
 * T-Block:  .#.           S-Block:  .##
 *           ###                     ##.
 *
 * Z-Block:  ##.           L-Block:  #..
 *           .##                     #..
 *                                   ##.
 *
 * J-Block:  .#            P-Block:  ##
 *           .#                      .#
 *           ##                      .#
 */
import { PieceDefinition } from '../types';

export const PIECE_DEFINITIONS: PieceDefinition[] = [
  {
    name: 'I-Block',
    // ####  (4 wide, 1 tall)
    vertices: [-2, -0.5, 2, -0.5, 2, 0.5, -2, 0.5],
    color: 0x00f0f0,
  },
  {
    name: 'O-Block',
    // ##  (2x2 square)
    // ##
    vertices: [-1, -1, 1, -1, 1, 1, -1, 1],
    color: 0xf0f000,
  },
  {
    name: 'T-Block',
    //  #     (bump on top, 3 wide base)
    // ###
    vertices: [
      -1.5, 0,    // bottom-left
      -1.5, -1,   // left side up
      -0.5, -1,   // inner left shoulder
      -0.5, -2,   // top-left of bump
       0.5, -2,   // top-right of bump
       0.5, -1,   // inner right shoulder
       1.5, -1,   // right side
       1.5, 0,    // bottom-right
    ],
    color: 0xa000f0,
  },
  {
    name: 'S-Block',
    //  ##   (offset right on top)
    // ##
    vertices: [
      -1.5, 0,    // bottom-left
      -1.5, -1,   // up left
      -0.5, -1,   // step in
      -0.5, -2,   // up to top row
       1.5, -2,   // top-right
       1.5, -1,   // down right
       0.5, -1,   // step in
       0.5, 0,    // down to bottom
    ],
    color: 0x00f000,
  },
  {
    name: 'Z-Block',
    // ##    (offset left on top)
    //  ##
    vertices: [
      -1.5, -2,   // top-left
      -1.5, -1,   // down left
      -0.5, -1,   // step right
      -0.5, 0,    // down to bottom
       1.5, 0,    // bottom-right
       1.5, -1,   // up right
       0.5, -1,   // step left
       0.5, -2,   // up to top
    ],
    color: 0xf00000,
  },
  {
    name: 'L-Block',
    // #      (3 tall, foot extends right)
    // #
    // ##
    vertices: [
      -0.5, -3,   // top-left
       0.5, -3,   // top-right
       0.5, -1,   // down to foot level
       1.5, -1,   // foot extends right
       1.5, 0,    // foot bottom-right
      -0.5, 0,    // bottom-left
    ],
    color: 0xf0a000,
  },
  {
    name: 'J-Block',
    //  #     (3 tall, foot extends left)
    //  #
    // ##
    vertices: [
      -0.5, -3,   // top-left
       0.5, -3,   // top-right
       0.5, 0,    // down right side
      -1.5, 0,    // foot bottom-left
      -1.5, -1,   // foot top-left
      -0.5, -1,   // inner corner
    ],
    color: 0x0000f0,
  },
];
