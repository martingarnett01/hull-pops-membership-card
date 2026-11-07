# Hull Pops Membership Card

A static web app that can be added to the home screen. Customers enter their email, check it, and get a QR code holding that email. Staff scan it in Shopify POS so nobody has to type the address.

## Hosting
Hosted on GitHub Pages from the `main` branch: https://martingarnett01.github.io/hull-pops-membership-card/
Anything pushed to `main` goes live within a minute or two. All paths are relative, so it also works on Netlify or a custom domain (`netlify.toml` is only used by Netlify).

Print a QR code of the site URL for the counter so customers can sign up on the spot.

## How it works
- The email is stored on the phone (localStorage) and **also put in the page URL** (`?m=…`).
  This matters on iPhone: a home-screen app does not share storage with Safari, so the URL is what carries the card over.
- A service worker caches the app, so the card opens with no signal.
- While the card is showing, the screen is kept awake where the phone supports it.
- Nothing is sent to a server. No member list is kept.

## Things to replace
- `icons/*.png` are placeholder "HP" icons. To use the real logo, swap in square PNGs at the same sizes (192, 512, a 512 "maskable" one with padding, and a 180 for Apple).
- The logo at the top of the page loads from the Shopify CDN. If it ever changes, update the URL in `index.html` and `sw.js`.

## After changing files
Bump `CACHE` in `sw.js` (e.g. `hullpops-card-v2`) so phones fetch the new version.

## Files
`index.html`, `styles.css`, `app.js` – the app
`qrcode.js` – QR encoder (Kazuhiko Arase, MIT licence)
`sw.js`, `manifest.webmanifest` – offline and home-screen support
`netlify.toml` – headers
