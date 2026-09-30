# Design QA — 港雀吃碰组合选择器

- Result: **passed**
- Date: 2026-09-30
- Selected direction: 方案 1，手牌上方中央组合托盘
- Reference: `C:\Users\User\.codex\generated_images\01a0d7ee-6ca8-7332-a3a7-0e6284368d51\exec-229f30d3-e71a-4078-9d65-39b91019972d.png`
- Implementation capture: `apps/mahjong/docs/claim-picker-final.png`
- Waiting-state capture: `apps/mahjong/docs/claim-picker-waiting.png`
- Side-by-side comparison: `apps/mahjong/docs/claim-picker-comparison.png`
- Preview URL: `http://127.0.0.1:5173/mahjong/?claim-preview=picker`
- Reviewed viewport: 1596 × 1041 px, landscape

## Checks

- The first action row exposes one button per legal action kind; duplicate text-only 「碰」 buttons are removed.
- Opening Pong shows every legal three-tile combination as tiles. Natural Pong precedes Fly Pong.
- The opponent's discarded tile is consistently the third tile and uses a gold outline, glow, and slight vertical lift.
- The selector includes 返回, 過, and an 8-second countdown without requiring explanatory substitution text on the Fly tile.
- The waiting state keeps the chosen tile group visible and provides 撤回 while other players respond.
- The selector stays above the player's hand and leaves the discard field visible. It fits within the table at the reviewed landscape viewport.
- Accessibility output names each option by action and tile contents, including which tile is the incoming discard.
- The production build succeeds. The existing Vite warnings for runtime-resolved table backgrounds and the large Three.js tile-model chunk remain non-blocking.

## Visual comparison

The implementation follows the selected reference's dark green and gold tray, centered title, side actions, two full tile combinations, emphasized incoming tile, and compact countdown. The live table uses its actual three-player seat layout and current tile assets, so the surrounding hand and table state differ from the illustrative reference.

## Result

No P0–P2 visual or interaction issue was found in the reviewed picker and waiting states. Physical Android/iPhone touch testing remains part of the broader device matrix rather than this browser QA.
