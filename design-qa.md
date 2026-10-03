# Reference lobby fidelity QA — 2026-10-03

- Source: C:/Users/User/AppData/Local/Temp/codex-clipboard-bf17a96b-99e2-4b50-a002-eb669e1d0376.png
- Implementation: apps/mahjong/implementation-lobby-precise.png
- Full comparison (source above): apps/mahjong/lobby-precise-comparison.png
- Focused comparison: apps/mahjong/lobby-focused-comparison.png
- Landscape capture: apps/mahjong/implementation-lobby-mobile.png
- Both desktop images: 1866 × 843 pixels, matching 1866 × 843 CSS viewport; no density normalization required.
- State: signed in, player mode, online selected, dialogs closed.
- QA used localhost:4200 with a separate local test account, leaving the user's existing room untouched.

## Comparison history

1. P1: oversized cards, small labels, green join action, separate connection buttons and outline icons. Replaced with reference coordinates, 52px serif titles, 30px action labels, gold/blue actions and one framed radio group.
2. P2: first revision's monitor/people shapes differed and connection labels were shifted. Added reference-derived transparent monitor, people and coin images; corrected connection alignment.
3. P2: inherited mobile avatar minimum width stretched the account pill. Removed that minimum and recaptured at 844 × 390.
4. Final full-view and focused comparisons inspected after corrections. No remaining P0/P1/P2 findings; residual P3 details below.

## Required fidelity surfaces

- Typography: Noto Serif TC 900 for mode/action titles, Noto Sans TC for controls; measured font sizes, line heights and positions.
- Layout: cards x445/y178, combined width977, height317; connection x574/y520, width719, height84; actions y664, height77. One-screen desktop and landscape.
- Colors: jade panels, cream text, gold selected glow, gold create and deep blue join action.
- Assets: reference-derived background, transparent monitor, people and coin; library book, volume and fullscreen glyphs. Interactive UI remains real text/buttons/inputs.
- Copy: reference labels preserved; account name and balance remain dynamic.

## Verification

- TypeScript/Vite production build passed.
- Browser verified: online/offline mutually exclusive radios, online join input, offline pairing panel, dialog closing, human/AI mode switching, account menu.
- Final isolated browser preview had no captured console errors.
- Desktop and 844 × 390 landscape visually checked; portrait retains existing landscape gate.
- No multiplayer game was started for this visual pass.

## P3 residual differences

- Reconstructed image textures, edge details and highlights are not pixel-identical.
- Minor differences remain in book/fullscreen glyph details, account-avatar silhouette, type rasterization and panel glow falloff.

## Generated asset provenance

Built-in imagegen created public/assets/lobby-reference-background.png, lobby-monitor.png, lobby-players.png and lobby-gold-coin.png. Background prompt: remove UI while preserving scene composition, cup, teapot, sign, lighting and perspective. Icon prompts: reproduce only the source monitor, three-person cream-to-gold symbol and upright gold coin on true transparency. Assets are integrated into app.tsx, rooms.tsx and lobby-reference.css.

final result: passed
