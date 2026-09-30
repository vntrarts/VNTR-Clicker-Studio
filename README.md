# VNTR Clicker Studio

A browser-based parametric 3D clicker generator inspired by the workflow of modern clicker configurators.

## Features
- Parametric clicker body and cap
- Cherry MX-style cavity
- Rounded/square/circle/pill/bar shapes
- Image/SVG/text/icon artwork with background removal and raster smoothing
- Raised, engraved and flat artwork modes
- Interactive Three.js preview
- Exploded view and switch preview
- STL, multi-object 3MF, and PNG preview export
- Portable project JSON save/load plus local persistence
- Anycubic Kobra X, Vyper, and CR-10S Pro V2 printer profiles
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

## Clicker workflow

The interface and feature set are independently implemented to follow the same general workflow as modern browser clicker generators: image/vector/text/icon input, color quantization, live 3D preview, Cherry MX-compatible fit controls, raised/flat/engraved artwork, 1–3 switch layouts, keychain attachment options, print orientation, and multicolor 3MF export. The project does not copy Vostok Labs source code or assets.

### Anycubic Kobra X

The built-in Kobra X profile uses the manufacturer's published 260 × 260 × 260 mm build volume, 0.4 mm standard hardened-steel nozzle, 0.25/0.6/0.8 mm nozzle options, 0.08–0.28 mm layer range, 300 mm/s recommended speed, 600 mm/s maximum speed, and 10,000/20,000 mm/s² recommended/maximum acceleration. These specifications are based on Anycubic's current Kobra X documentation.
