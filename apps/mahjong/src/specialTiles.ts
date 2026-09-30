/** Approved Malaysian animal, face and 飛 artwork on one transparent atlas. */
export const SPECIAL_TILE_ATLAS = '/mahjong/assets/tiles/malaysian-special-tiles.png'
export const SPECIAL_TILE_ATLAS_SIZE = { width: 1536, height: 1024 }

export type TileRegion = { x: number; y: number; width: number; height: number }

const animalRegions: Record<string, TileRegion> = {
  a1: { x: 144, y: 17, width: 270, height: 339 },
  a2: { x: 474, y: 17, width: 270, height: 339 },
  a3: { x: 795, y: 17, width: 271, height: 339 },
  a4: { x: 1121, y: 17, width: 271, height: 339 },
}
const faceRegion: TileRegion = { x: 187, y: 379, width: 256, height: 329 }
const flyRegion: TileRegion = { x: 656, y: 723, width: 225, height: 285 }

export function specialTileRegion(code: string): TileRegion | undefined {
  if (code === 'x1') return flyRegion
  if (code === 'h1' || code === 'h2' || code === 'h3' || code === 'h4') return faceRegion
  return animalRegions[code]
}
