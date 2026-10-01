# 港雀顶栏设计验收

- Source visual truth: `qa/selected-option-2.png` (1779 × 884 px), with the user's later instruction to remove the center dealer badge.
- Implementation capture: Codex in-app browser screenshots captured inline from `/mahjong/` and the side-by-side comparison page `qa/design-compare.html`. The browser capture API displayed the PNG in the task but did not export a local screenshot file.
- Viewport: in-app browser 1280 × 720 CSS px at its default density; responsive check used an 800 × 450 CSS px iframe in `qa/narrow-check.html`.
- Comparison normalization: the selected image was scaled to the same visual width as the 1280 × 720 implementation iframe on `qa/design-compare.html`. The reference has a wider aspect ratio, so the comparison is limited to the top controls and table composition, not tile-for-tile matching.
- State: live online three-player room, menu open. Reference content is conceptual; players, tiles, round number, and turn timer differ from the running game.

## Findings

No remaining P0, P1, or P2 mismatch in the requested top controls. The brand and wallet occupy the left, round and wall count remain centered, and voice plus one menu trigger occupy the right. The dealer badge is absent. Room and settings controls remain functional in the menu.

### Required fidelity surfaces

- Fonts and typography: existing Noto Serif TC display text and Noto Sans TC controls match the game's visual language. Button and wallet text were enlarged after the first comparison.
- Spacing and layout: three independent header zones have no overlap at 1280 × 720 or 800 × 450. At 800 × 450, the requested narrow single-column menu occupies x=646.8–788.8 px while the right player label ends at x=650 px, leaving the text unobscured.
- Colors and visual tokens: dark emerald, antique gold, and the green voice state remain consistent with the selected design.
- Image quality and assets: the existing 3D table, tea-house background, and tile assets were retained. Menu icons use Phosphor icons; no rasterized UI was substituted for live controls.
- Copy and content: voice, wallet, remaining tiles, settings, cancel, leave, and home labels remain available. The center dealer label was intentionally removed per the latest user request.

## Comparison history

1. Initial wide capture showed the opened menu obscuring the right player label. The label is now moved below the open menu at full height.
2. The 800 × 450 capture initially showed a two-column menu. After the user's visual correction, it now uses the narrow single-column structure from the selected reference, with smaller type and controls.
3. The right player label moves left while the menu is open, so both remain readable. Post-fix captures showed no overlap. Music toggle, volume panel, and guide entry were exercised in the browser. The voice join entry was visually checked; microphone permission and two-device audio were outside this layout check.

## Follow-up polish

- P3: The selected mock uses a slightly larger voice button and wallet badge. Both were enlarged within the space available at 1280 × 720; exact text proportions may vary with browser font rendering.

final result: passed
