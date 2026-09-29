# VNTR Clicker Studio

A browser-based parametric 3D clicker generator inspired by the workflow of modern clicker configurators.

## Features
- Parametric clicker body and cap
- Cherry MX-style cavity
- Rounded/square/circle/pill/bar shapes
- Image/SVG/text/icon artwork
- Raised, engraved and flat artwork modes
- Interactive Three.js preview
- Exploded view and switch preview
- STL and multi-object 3MF export
- Local project save/load
- Anycubic Vyper and CR-10S Pro V2 presets
- GitHub Pages deployment

## Local development
```bash
npm install
npm run dev
```

Production build:
```bash
npm run build
```

## GitHub Pages
The included GitHub Actions workflow builds the Vite app and deploys `dist/` to GitHub Pages on pushes to `main`.

In the repository, open **Settings → Pages** and select **GitHub Actions** if Pages has not already been configured.

## Important
This is an independently implemented VNTR tool. It is not a copy or redistribution of Vostok Labs source code, assets, branding, or proprietary implementation.