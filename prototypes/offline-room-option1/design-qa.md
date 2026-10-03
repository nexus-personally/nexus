# Design QA — Offline Room Option 1

## Reference

- Source: `reference-option1.png`
- Reference size: 1487 × 1058
- Target: desktop offline-room waiting state

## Visual comparison

- Overall composition: passed. Header, centered room summary, two-column workspace, and bottom actions match the reference hierarchy.
- Background and atmosphere: passed. Photoreal tea-house table, jade felt, dark vignette, ivory type, and warm-gold accents are preserved.
- Invite panel: passed. Two-step header, real QR code, centered instruction, and full-width copy action match the selected design.
- Seat panel: passed. `3/3` count, three grouped seat rows, player-ready indicator, and computer-fill details match the selected design.
- Typography and iconography: passed. Serif display hierarchy and Phosphor interface icons provide the intended game UI character.
- Responsive behavior: passed. The 1487 × 1058 reference viewport preserves the measured composition. The 844 × 390 phone-landscape viewport keeps the same two-column hierarchy, fits all primary actions above the fold, and does not clip or require scrolling.

## Interaction checks

- Invite / response tabs: implemented.
- Copy room code / pairing text feedback: implemented.
- Camera scan, game controls, enter, and leave feedback: implemented.
- Keyboard-focusable native buttons: implemented.

## Build verification

- `npm run build`: passed.
- `npm run test:sites`: 4/4 passed.

## Verified viewports

- Reference desktop: 1487 × 1058
- Phone landscape: 844 × 390

final result: passed
