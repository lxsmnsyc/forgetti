import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import forgettiPlugin from 'vite-plugin-forgetti';

export default defineConfig({
  plugins: [
    react({
      fastRefresh: false,
    }),
    forgettiPlugin({
      preset: 'react',
      filter: {
        include: 'src/**/*.{ts,js,tsx,jsx}',
        exclude: 'node_modules/**/*.{ts,js,tsx,jsx}',
      },
    })
  ],
});
