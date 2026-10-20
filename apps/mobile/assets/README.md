# LingWu capybara

`capybara.png` is original artwork generated for LingWu with the built-in image-generation tool on September 16, 2026. The transparent PNG is bundled locally and used by the shared `Mascot` component as the default avatar. The asset is included under this repository's MIT license.

`avatar1.png`–`avatar6.png` are the six selectable photo avatars shown in the agent preference sheet; the picked value (`avatar1`–`avatar6`) is persisted in the `identity.avatar` field and rendered as a circular photo by `Mascot`.

`logo.png` (48×48) and `logo.svg` are LingWu's site logo, used for the web brand mark and favicon. `apps/mobile/public/favicon.png` and `favicon.svg` are shipped copies served at `/favicon.png` and `/favicon.svg` in the web build; `app.json`'s `web.favicon` additionally points at `logo.png` so Expo also serves `/favicon.ico`. The custom web template `apps/mobile/public/index.html` references these as the browser-tab icon (SVG preferred, PNG fallback) and the iOS `apple-touch-icon`.

Generation prompt: “An original friendly capybara assistant mascot, with a broad boxy rounded snout, small round ears, tiny relaxed eyes, a squat body and short legs. Sitting in a gentle three-quarter view, with warm caramel and oat tan coloring, a calm expression, a soft clay/plush finish and restrained detail readable at 48–96 pixels. Entire character centered on a transparent background. One character, no clothing, props, text, logos or watermark.”
