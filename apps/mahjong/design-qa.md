# Settlement Design QA

- Source visual truth: `C:\Users\User\.codex\generated_images\01a0fb89-cf9b-7640-8f31-d87e0ecaca44\exec-f4df8440-408c-4f79-844a-27edc5898a74.png`
- Implementation: `http://127.0.0.1:4201/mahjong/?result-preview=1`
- Browser evidence: Codex in-app browser captures at 1440×900, 1024×768, and 956×440 (the browser capture API did not expose a persistent local screenshot path).
- State: normal 9-fan, three-player round result.
- Density: CSS pixel viewport at device scale 1; the reference was visually normalized to each viewport.

## Full-view comparison evidence

The implementation and reference use the same dominant composition: darkened tea-house table, wide centered cream-and-jade result panel, 34% hero / 66% content split, large circular 胡 seal, centered result title and fan badge, left fan list, right settlement ledger, and a full-width dark jade CTA. The implementation keeps the complete result above the fold at all three tested landscape sizes.

## Focused comparison evidence

- Header: seal, result title, fan badge, mahjong mist art, collapse control and ornamental frame were checked at desktop and phone landscape sizes.
- Fan list: all eight rows, per-row fan pills and total remain visible without scrolling.
- Ledger: three players, positive/negative colors, winner emphasis, totals note and CTA remain aligned and readable.
- Responsive: panel bounds and document overflow were measured at 1440×900 and 956×440. Desktop panel: 1267×737 at x86/y81. Phone panel: 870×400 at x43/y20. No horizontal or vertical body overflow.

## Fidelity surfaces

- Fonts and typography: Noto Serif TC provides the display hierarchy; Noto Sans TC handles compact UI labels. Optical size is reduced at short landscape heights while keeping the same hierarchy.
- Spacing and layout rhythm: two-column 47/53 split matches the source; hero and content proportions, row spacing and panel padding scale through container units.
- Colors and visual tokens: jade, cream, antique gold, winner gold and loss red match the reference palette.
- Image quality and asset fidelity: the generated 胡 seal, ornate gold border, mahjong mist and cloud/bamboo artwork are used as real transparent PNG assets; no placeholder or CSS-drawn replacement is present.
- Copy and content: title, 9 fan, eight fan entries, three-player settlement values and CTA match the selected reference state.

## Comparison history

1. Initial implementation: modal was too short, ornamental top line crossed the eyebrow, and the Hu image had not finished loading in the first capture.
2. Fixes: increased desktop height from 86cqh to 91cqh, changed hero/content split from 32/68 to 34/66, expanded and offset the ornamental border outside the content line, then re-captured after all images loaded.
3. Post-fix evidence: desktop, iPad Mini and iPhone 16 Pro Max landscape all show the complete layout with no clipping or body overflow. Collapse and restore interactions both work.

## Findings

No actionable P0, P1, or P2 visual mismatch remains. The phone layout intentionally uses smaller typography to keep every required item visible without scrolling.

## Follow-up polish

- P3: Fine-tune subpixel text rendering on physical iOS Safari after device testing; browser font rasterization can differ from Windows.
- Existing Three.js texture warnings are unrelated to the settlement UI and were present in the game scene; no browser errors were introduced by this change.

## Implementation checklist

- [x] Desktop 1440×900
- [x] iPad Mini 1024×768
- [x] iPhone 16 Pro Max landscape 956×440
- [x] Collapse / restore interaction
- [x] No viewport overflow
- [x] Production build
- [x] 27 automated tests

final result: passed
