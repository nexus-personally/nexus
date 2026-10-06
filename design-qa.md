# NEXUS Split Expense Editor — Design QA

## Evidence

- Source visual truth: `C:\Users\User\.codex\generated_images\01a10d4c-f8c7-7c50-9249-01f2e03f1ee8\exec-a3c3bbd1-4e85-4b64-a5ac-2755ec93db7f.png`
- Source pixels: 853 × 1844. The generated concept is a long-density mock; comparison normalized to its intended 390px mobile content width rather than treating its extra vertical canvas as a requirement.
- Implementation: `https://nexus-2rwr.onrender.com/split/groups/12fb4610-ecf7-4b9c-85c4-e88a54283d67/expenses/new`
- Implementation screenshot: browser-rendered inline capture from the Codex desktop browser session.
- CSS viewport: 390 × 844.
- Implementation capture: 390 × 844 CSS pixels; browser-managed device density.
- State: authenticated new-expense form, MYR, dining category, payer `hw`, two participants, equal split, optional note collapsed.

## Full-view comparison

The implementation preserves the selected concept's hierarchy while fitting the complete default workflow into one 390 × 844 viewport: compact header, receipt-style category/name/amount block, one grouped detail surface, 2 × 2 split-method control, collapsed optional note, and persistent save action. The implementation intentionally uses the existing app's paper texture, palette, category artwork, typography, safe-area behavior, and production data bindings.

## Focused-region comparison

- Receipt region: category, description, currency, and amount are aligned as one primary unit. Amount emphasis is retained without dominating the page.
- Detail region: date, payer, and participants use consistent 56px rows, separators, and Lucide interface icons.
- Action region: all four split methods remain at least 44px tall; the save button is 50px tall and remains visible at the bottom.
- Optional-content region: the note begins as a compact row and expands to a real textarea on keyboard activation.

## Required fidelity surfaces

- Fonts and typography: existing rounded Split typography retained; hierarchy now uses 12–18px supporting text and a 32–44px responsive amount.
- Spacing and layout rhythm: 18px page gutters, 14px form gaps, compact 56px detail rows, and consistent grouped surfaces match the selected direction.
- Colors and visual tokens: existing cream paper, forest green, mustard, brick red, and pencil-gray tokens retained.
- Image quality and assets: existing category artwork and installed Lucide icons are used; no new placeholder art or handcrafted SVG was introduced.
- Copy and content: current Simplified Chinese labels, `MYR`, payer name, participant count, and existing product behavior are preserved.

## Findings

No actionable P0, P1, or P2 visual differences remain. The production implementation is slightly more compact than the generated source vertically; this is intentional because the user requested less oversized, less scattered content and the product target is a 390 × 844 viewport.

## Interaction and runtime checks

- Authenticated form loaded with real production data.
- Optional note expanded by keyboard activation and exposed the textarea.
- Category control opened the existing bottom sheet.
- All visible buttons in the 390px state measured at least 44px tall.
- Page height matched the 844px viewport in the collapsed-note state.
- Browser console warnings/errors: none.

## Comparison history

- Pass 1: no P0/P1/P2 mismatch found; no corrective iteration required.

## Follow-up polish

- P3: a future pass could add a very small hand-drawn accent beside the `费用详情` heading, but it is not needed for clarity or fidelity.

final result: passed
