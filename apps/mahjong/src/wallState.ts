import type { Game } from './engine'

export type WallSide = 'north' | 'east' | 'south' | 'west'
export type WallTileState = {
  id: number
  side: WallSide
  stack: number
  layer: 'bottom' | 'top'
  drawn: boolean
  x: number
  y: number
  z: number
  rotation: number
}

const SIDE_ROTATION: Record<WallSide, number> = {
  north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2,
}

/** Clockwise around the physical square; seat order is independent of this path. */
function stackPath(count: 3 | 4): { side: WallSide; stack: number; x: number; z: number }[] {
  const sides: [WallSide, number][] = count === 4
    ? [['south', 18], ['west', 18], ['north', 18], ['east', 18]]
    : [['south', 18], ['west', 20], ['east', 20]]
  return sides.flatMap(([side, length]) => Array.from({ length }, (_, stack) => {
    const direction = side === 'south' || side === 'west' ? 1 : -1
    const offset = ((length - 1) / 2 - stack) * .77 * direction
    return {
      side, stack,
      x: side === 'south' || side === 'north' ? offset : side === 'west' ? count === 4 ? -8.1 : -7.7 : count === 4 ? 8.1 : 7.7,
      z: side === 'south' ? 3.5 : side === 'north' ? -7.25 : (count === 3 ? -2.9 : -1.3) + offset,
    }
  }))
}

/** The live wall is read top then bottom, stack by stack, across all sides. */
export function getWallState(game: Game): WallTileState[] {
  const path = stackPath(game.count)
  const drawOrder = [...(game.wallOrder ?? game.wall.map(tile => tile.id))].reverse()
  const remaining = new Set(game.wall.map(tile => tile.id))
  const start = (game.wallBreak ?? 0) % path.length
  return drawOrder.map((id, index) => {
    const { side, stack, x, z } = path[(start + Math.floor(index / 2)) % path.length]
    const layer = index % 2 === 0 ? 'top' : 'bottom'
    return {
      id, side, stack, layer, drawn: !remaining.has(id), x, z,
      y: layer === 'top' ? .9775 : .4925,
      rotation: SIDE_ROTATION[side],
    }
  })
}
