import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({base:'./',optimizeDeps:{exclude:['manifold-3d']},assetsInclude:['**/*.wasm'],worker:{format:'es'},resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}}});