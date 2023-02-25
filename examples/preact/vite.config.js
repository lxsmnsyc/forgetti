import { defineConfig } from 'vite'
import preact from "@preact/preset-vite";
import forgettiPlugin from 'vite-plugin-forgetti';

export default defineConfig({
  plugins: [
    preact({
      prefreshEnabled: true,
    }),
    forgettiPlugin({
      preset: 'preact',
      filter: {
        include: 'src/**/*.{ts,js,tsx,jsx}',
        exclude: 'node_modules/**/*.{ts,js,tsx,jsx}',
      },
    })
  ],
});
