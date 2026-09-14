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
- Store the compressed photo source, 1:1 crop position, zoom, and cropped output so the crop can be adjusted after reload.
- Use a circular safe-area preview for photo cropping. Support pointer and touch dragging plus zoom; rotation and flipping are intentionally excluded.
- Keep one shared photo and one global `Show profile photo` setting across all templates.
- Expose resume colors through the `Colors` panel, not persistent command-bar swatches.
- Provide 24 accent presets, 16 heading presets, 12 body presets, native color pickers, and editable HEX values.
- Apply heading and body colors only to light content areas. Dark structural panels retain automatic high-contrast text.
- Show contrast ratios and warnings for low-contrast custom colors without blocking the user's choice.
- Preserve custom colors when switching templates. `Reset to template defaults` is the only action that replaces them with the selected template's defaults.

## Review Checklist

- [ ] Text command buttons use `25px` radius.
- [ ] Icon-only controls are circular and have accessible labels.
- [ ] Focus states are visible with keyboard navigation.
- [ ] Disabled states are visually distinct and non-interactive.
- [ ] Template cards remain equal width and incomplete rows are centered.
- [ ] Desktop and mobile layouts are checked for clipping, overlap, and unintended horizontal scrolling.
