# Resume Editor Design Audit

Date: 2026-09-15
Surface: `/resume/resume-demo/edit`
Mode: Combined UX and screenshot-based accessibility audit

## Overall verdict

The editor already has a credible desktop-publishing foundation: the A4 canvas is visually dominant, global actions are grouped at the top, and sections are directly manageable. The next design pass should add depth through clearer modes and contextual controls, not through another row of permanent controls.

## Captured steps

1. Default editor — generally healthy. The canvas is clear and the main actions are discoverable, but the second toolbar is mostly empty and the selected section exposes several cryptic icon-only actions.
2. Document colors — usable with reservations. Accent-only scope is appropriate and the contrast value is useful, but the centered modal blocks the document and separates the control from its trigger.
3. Text color — needs refinement. The contextual intent is good, but the palette is dense, horizontally scrollable, and overlaps both navigation and canvas.

## Strengths

- A4 preview remains the primary visual focus.
- Save state, Share, and Export PDF are easy to find.
- Template-level Accent and per-field Text color are correctly separated.
- Contrast ratios and explicit labels provide useful reassurance.
- Section ordering, visibility, duplication, deletion, and addition are available without leaving the editor.

## Highest-impact opportunities

1. Replace the mostly-empty second toolbar with a contextual inspector. When nothing is selected, show a compact hint. When text is selected, show Text color and relevant field actions. When a section is selected, show section actions and layout choices.
2. Move styling into a right-side inspector with two tabs: `Design` and `Review`. Design contains Template, Accent, spacing, and optional density controls. Review contains completeness, missing fields, overflow warnings, and ATS-safe suggestions.
3. Simplify the left rail. Keep drag handle, title, visibility state, and a single overflow menu on each section card. Move duplicate/delete and secondary actions into that menu, with text labels.
4. Use compact anchored popovers. Document Accent should open beneath its trigger. Text color should open near the contextual toolbar or in the right inspector. Neither should cover the section rail and main content simultaneously.
5. Reduce palette density. Show `Document`, `Recently used`, and a short curated palette first; put the full spectrum and HEX input behind `More colors`.
6. Add a floating bottom-right canvas control for Fit, zoom, and page navigation. This keeps document controls close to the preview and frees the header.
7. Add richer section creation. Replace the small select-plus-Add row with an `Add section` drawer containing grouped choices, short descriptions, and optional starter layouts.

## Accessibility risks visible in screenshots

- Several section action buttons rely on tiny symbols, so their meaning is hard to scan visually even if accessible names exist.
- Small action targets and low-contrast helper text may be difficult at reduced zoom.
- Color choice should never be communicated by swatches alone; selected state should retain a clear outline/checkmark and readable color value.
- The horizontal scrollbar in Text color is a reflow warning and makes keyboard navigation harder to understand.

Keyboard order, focus trapping, screen-reader announcements, and actual contrast values require interactive/code-level testing and cannot be confirmed from screenshots alone.

## Recommended visual direction

Use a `focused publishing workspace`: warm-white chrome, soft gray-green canvas surround, dark navy primary actions, restrained teal accent, 8px panels, 24–28px pills only for high-level actions, and subtle elevation reserved for inspectors. Keep the resume itself visually independent from the editor chrome.

## Evidence

- `01-editor-default.png`
- `02-document-colors.png`
- `03-text-color.png`
