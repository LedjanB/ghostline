# Shipping Ghostline

Commands are for Windows **cmd**. Run them inside the `ghostline` folder.

## 1. GitHub Pages (free, already set up)
1. Go to https://github.com/LedjanB/ghostline/settings/pages
2. Under **Source** pick **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**, click **Save**
4. Wait 1 to 2 minutes, then open https://ledjanb.github.io/ghostline/

Privacy policy link for stores: https://ledjanb.github.io/ghostline/privacy.html

## 2. itch.io (free, best place for indie games)
### Build the zip
```
npm install
npm run build:itch
```
That makes `dist\ghostline-itch.zip`.

### Upload it (web, no tools needed)
1. Make an account at https://itch.io and log in
2. Click your name (top right) > **Upload new project**
3. Fill it in from `docs/store/itch-page.md` (title, tagline, tags, description)
4. **Kind of project: HTML**
5. Under **Uploads** click **Upload files** and pick `dist\ghostline-itch.zip`
6. Tick **This file will be played in the browser**
7. Embed options: 960 x 540, tick **Mobile friendly** (Landscape) and **Fullscreen button**
8. Upload the cover (`docs/store/cover-630x500.png`) and every screenshot in `docs/store/screenshots`
9. Set **Visibility** to **Draft**, click **Save & view page**, play it once to check
10. Change visibility to **Public** and save

### Updating later (optional, with butler)
1. Download butler: https://itchio.itch.io/butler
2. Unzip it somewhere, for example `C:\butler`
3. Log in once:
```
C:\butler\butler login
```
4. Every update:
```
npm run build:itch
C:\butler\butler push dist\itch ledjanb/ghostline:html --userversion 5.0.0
```
Change `ledjanb` to your itch username if it's different.

## 3. Phone home screen app (free, works now)
- iPhone: open the GitHub Pages link in Safari > Share > **Add to Home Screen**
- Android: open it in Chrome > menu > **Install app**

It runs fullscreen and offline after the first open.

## 4. App Store and Google Play (costs money)
The game is a web app, so it needs a wrapper like Capacitor (https://capacitorjs.com).
- Google Play: $25 once. Works from Windows with Android Studio.
- Apple App Store: $99 per year, and you need a Mac with Xcode to build and upload.
- Both stores need: the privacy policy link above, screenshots, an age rating form (answer "cartoon or fantasy violence: infrequent/mild"), and an icon (`icons/icon-512.png`).

Ask Claude to "set up Capacitor for Ghostline" when you're ready and have the accounts.

## Before every release
```
npm test
```
All tests should pass. Then bump `version` in `package.json` and `CACHE` in `sw.js` so phones pick up the new files.
