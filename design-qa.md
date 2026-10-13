# NEXUS Split monthly home — design QA

- Source visual truth: `C:\Users\User\AppData\Local\Temp\codex-clipboard-d861cc5e-886c-4351-99ab-783980abcf29.png` plus the approved monthly-home interaction brief in this task.
- Implementation: `http://127.0.0.1:4200/split/home`.
- Implementation screenshot: captured in the Codex in-app browser task record (the browser provider did not expose a filesystem export path).
- Viewport: 390 × 844 CSS px, density managed by the in-app browser.
- Source image: 761 × 1517 px. It is a style/layout-density reference, not the same screen.
- State: authenticated local user, base monthly total RM 6,000, manual income RM 8,000, remaining balance RM 14,000.

## Findings

No actionable P0, P1 or P2 findings remain.

- Typography: the rounded handwritten fallback stack, heavy amount hierarchy and compact small labels match the established Split crayon direction. The balance amount wraps safely at 390 px.
- Spacing and layout: the page is intentionally much calmer than the dense expense-editor reference. The balance card is the only main region, touch targets remain at least 44 px, and the persistent navigation stays visible above the safe area.
- Colors and tokens: forest green, mustard, brick red, cream paper, pencil gray and hand-drawn shadows reuse the existing Split theme tokens. Negative balance has a distinct brick-red semantic state.
- Image/asset quality: the existing paper texture is reused without scaling artifacts. Standard UI icons come from the installed Lucide library; no replacement raster or handcrafted inline SVG was introduced.
- Copy: all new user-facing text is Chinese except currency and user-entered names, matching the product requirement.
- Accessibility: the progress bar has an accessible name and numeric range; icon controls have labels; bottom sheets use dialog semantics; the mandatory budget sheet cannot be dismissed; form inputs have visible labels.

## Full-view comparison evidence

The source and 390 × 844 implementation were inspected together. The implementation preserves the source's paper texture, uneven ink borders, mustard emphasis, green primary action, rounded hand-drawn typography and offset crayon shadows. The new screen deliberately reduces density to one dominant card, as requested.

## Focused-region comparison evidence

Focused checks covered the balance card, first-entry sheet, adjustment sheet, Settings rows and bottom navigation. Text, controls and monetary values remained readable without horizontal overflow. A separate crop was unnecessary because each region was legible in the 390 px browser capture.

## Interaction verification

- Required first-entry total: RM 6,000 saved and sheet closed.
- Manual income: RM 8,000 produced RM 14,000 remaining.
- Adjustment record appeared with the correct date and edit/delete controls.
- Settings name confirmation advanced to one text field.
- Home, Groups and My navigation worked.
- Browser console errors checked: none.

## Comparison history

- Initial implementation exposed the PostgreSQL `date` value as an ISO timestamp in the adjustment history (P2 copy-format mismatch).
- Fix: normalized adjustment dates to `YYYY-MM-DD` at the API boundary.
- Post-fix evidence: the browser showed `2026-10-13` and no console errors.
- Follow-up screenshot found that `RM 14,000.00` could wrap after `RM` and that an untouched month displayed an empty bar (P2 hierarchy and semantic-direction issues).
- Fix: added value-length typography tiers with no wrapping, and changed the bar to represent remaining balance rather than spent balance.
- Post-fix evidence: at 390 px `RM 14,000.00` stays on one line, the bar reports value 100 and renders fully filled, and the console remains error-free.

## Follow-up polish

- P3: a future custom bundled Chinese rounded font could improve character consistency across Windows and mobile platforms; the current fallback is acceptable and matches the existing app.

## Implementation checklist

- [x] Mobile-first balance card
- [x] Required monthly-total onboarding
- [x] Manual income/expense sheet and history
- [x] Settings confirmation/edit flows
- [x] Persistent three-item navigation
- [x] 390 px visual and interaction verification

final result: passed
