/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#173B3F',
    tint: '#176B63',

    // Core surfaces
    background: '#F7F5EF',
    foreground: '#173B3F',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#173B3F',

    // Primary action color (buttons, links, active states)
    primary: '#176B63',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E5EFEC',
    secondaryForeground: '#176B63',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EEF1ED',
    mutedForeground: '#69807D',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F3E2D9',
    accentForeground: '#A34D35',

    // Destructive actions (delete, error states)
    destructive: '#B8483D',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DCE4DE',
    input: '#CAD8D2',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
