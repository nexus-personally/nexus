# NEXUS UI Standards

This document defines the shared interaction rules for NEXUS product surfaces. New UI must follow these rules unless a documented accessibility or domain constraint requires an exception.

## Component Direction

- Keep the NEXUS neutral black, white, gray, and cyan visual system.
- Use HeroUI as a visual and interaction reference, not as a runtime dependency. The current application is Angular while HeroUI's web component package targets React.
- Prefer quiet surfaces, light borders, clear hierarchy, and compact product-focused spacing.
- Every interactive control must expose visible hover, pressed, keyboard-focus, and disabled states where applicable.

Reference: https://heroui.com/en/docs/react/components/button

## Button Radius

The canonical radius for every text command button is exactly `25px`.

```css
:root {
  --radius-button: 25px;
  --radius-icon-button: 999px;
}

button {
  border-radius: var(--radius-button);
}
```

This applies to primary, secondary, outline, ghost, danger, segmented-filter, upload, retry, save, publish, and full-width command buttons. Button height and horizontal padding should preserve a clearly elliptical silhouette.

## Exceptions

- Icon-only buttons remain circular with `border-radius: 50%` or `var(--radius-icon-button)`.
- Switch tracks remain capsules and their thumbs remain circular.
- Color swatches remain circular.
- Large selection surfaces, including resume template previews and document-section rows, follow their container radius rather than the command-button radius.
- Tags, status chips, and badges are not buttons and may use a full capsule radius.

## Interaction States

- Hover: increase border or surface contrast without shifting layout.
- Pressed: a subtle scale response is allowed, but it must not resize surrounding content.
- Focus: use the shared cyan focus ring with sufficient contrast and a visible offset.
- Disabled: reduce emphasis, remove pointer interaction, and preserve readable labels.
- Tooltips: icon-only controls with unfamiliar meaning must expose a concise accessible name and visible tooltip.

## Resume Studio Layout

- Do not use a persistent left sidebar on the Resume Studio dashboard.
- Place the NEXUS return mark in the top-left header area and link it to `/`.
- Apply `clamp(32px, 5vw, 80px)` horizontal padding and a `1440px` maximum width to the template grid only.
- Keep the template heading and its search/filter tools aligned to the full workspace width.
- Use three equal-width template cards per row on desktop.
- Center an incomplete final row as a group; five templates must render as `3 + 2`.
- Keep the create panel docked on desktop. Place it in normal document flow below the workspace on tablet and mobile layouts.
- Reduce the template grid to two columns on tablet and one column on narrow mobile screens.

## Resume Editor

- Every resume template must support the shared optional profile photo. Hiding the photo collapses its layout space completely.
- Treat pasted resume content as plain text. Strip source HTML, font family, size, weight, color, background, decoration, and links before insertion.
- Collapse pasted whitespace in single-line fields. Preserve plain line breaks only in multiline fields such as summaries and project descriptions.
- Define typography by semantic role: name, headline, contact, section title, organization, metadata, body, role, and skill label.
- Keep each template's semantic typography values fixed across editing, previews, printing, and PDF output. Long content wraps and must never trigger automatic font shrinking.
- Allow resume text colors to come only from the template, the shared Accent control, and per-field Text color overrides.
- Store the compressed photo source, 1:1 crop position, zoom, and cropped output so the crop can be adjusted after reload.
- Use a circular safe-area preview for photo cropping. Support pointer and touch dragging plus zoom; rotation and flipping are intentionally excluded.
- Keep one shared photo and one global `Show profile photo` setting across all templates.
- Expose resume colors through the `Colors` panel, not persistent command-bar swatches.
- Provide 24 accent presets, a native color picker, and an editable HEX value in Document colors. Keep text-role choices in Text color.
- Apply heading and body colors only to light content areas. Dark structural panels retain automatic high-contrast text.
- Show contrast ratios and warnings for low-contrast custom colors without blocking the user's choice.
- Preserve custom colors when switching templates. `Reset to template defaults` is the only action that replaces them with the selected template's defaults.
- Provide semantic document colors for names, headlines, contact details, section titles, organizations, roles, metadata, descriptions, bullets, skill labels, and skill text.
- Every user-editable resume field may override its semantic color. Field overrides apply to the whole field, never to a rich-text substring, and can be cleared with `Use global color`.
- Keep source formatting stripped on paste even when field color overrides are enabled. Only colors chosen inside Resume Studio may persist.
- Experience bullets and simple-list sections support visible-on-focus add/delete controls, Enter to insert, empty Enter to leave the list, and empty Backspace to remove while retaining at least one item.
- Render the resume as a fixed A4 canvas at every screen size. Responsive behavior scales the complete canvas; it must not change template columns, typography, spacing, or document flow.
- Default the editor preview to `Fit`, allow manual 50%-125% zoom, and permit horizontal scrolling when a manual zoom is wider than the viewport. Preview zoom never changes saved resume data or PDF dimensions.
- Use 44px top and bottom content safety areas in preview and print. Full-width template backgrounds may reach the page edge while their content observes the safety area.
- Print each output page at `210mm x 297mm`; allow overflowing content to continue onto additional A4 pages without shrinking typography or clipping content.

## Review Checklist

- [ ] Text command buttons use `25px` radius.
- [ ] Icon-only controls are circular and have accessible labels.
- [ ] Focus states are visible with keyboard navigation.
- [ ] Disabled states are visually distinct and non-interactive.
- [ ] Template cards remain equal width and incomplete rows are centered.
- [ ] Rich-text paste cannot override resume typography or colors.
- [ ] Every editable resume field can inherit or override its semantic text color.
- [ ] Adding and removing list items does not leak editor controls into preview or print.
- [ ] Narrow screens scale the A4 canvas without changing its internal layout.
- [ ] Preview zoom has no effect on PDF page size.
- [ ] Desktop and mobile layouts are checked for clipping, overlap, and unintended horizontal scrolling.
