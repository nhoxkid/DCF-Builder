import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
        'surface-glass': 'rgba(15, 23, 42, 0.6)',
        primary: '#e2e8f0',
        accent: {
          blue: '#4f9cff',
          teal: '#34d399'
        }
      },
      backdropBlur: {
        xs: '4px'
      },
      boxShadow: {
        glass: '0 20px 50px -25px rgba(15, 23, 42, 0.8)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.1)'
      },
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
