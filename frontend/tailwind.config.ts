import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--wg-accent-soft)',
          100: 'var(--wg-accent-soft)',
          200: 'var(--wg-border)',
          300: 'var(--wg-border-strong)',
          400: 'var(--wg-theme-accent)',
          500: 'var(--wg-theme-accent)',
          600: 'var(--wg-theme-accent)',
          700: 'var(--wg-accent-hover)',
          800: 'var(--wg-accent-hover)',
          900: 'var(--wg-text)',
          950: 'var(--wg-bg)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '0.875rem' }],
        xs:    ['0.75rem',   { lineHeight: '1rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
        base:  ['0.875rem',  { lineHeight: '1.5rem' }],
        lg:    ['1rem',      { lineHeight: '1.5rem' }],
        xl:    ['1.125rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem',   { lineHeight: '1.75rem' }],
        '3xl': ['1.5rem',    { lineHeight: '2rem' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        88: '22rem',
        100: '25rem',
        112: '28rem',
        128: '32rem',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'xs':    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card':  '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'lift':  '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
        'float': '0 8px 24px -4px rgb(0 0 0 / 0.1), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        'modal': '0 24px 48px -12px rgb(0 0 0 / 0.2)',
        'inner-xs': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'glow-indigo': '0 0 0 3px rgba(99, 102, 241, 0.15)',
        'glow-rose':   '0 0 0 3px rgba(244, 63, 94, 0.15)',
        'glow-emerald':'0 0 0 3px rgba(16, 185, 129, 0.15)',
      },
      transitionTimingFunction: {
        'spring':  'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth':  'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
      },
      animation: {
        'slide-up':   'slide-up 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':   'scale-in 0.18s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':    'fade-in 0.2s ease forwards',
        'spin-slow':  'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':    'shimmer 1.5s ease-in-out infinite',
        'float':      'float-slow 8s ease-in-out infinite',
        'blob-1':     'blob-drift-1 16s ease-in-out infinite',
        'blob-2':     'blob-drift-2 20s ease-in-out infinite',
      },
      keyframes: {
        'slide-up':  { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'scale-in':  { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        'fade-in':   { from: { opacity: '0' }, to: { opacity: '1' } },
        'shimmer':   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'float-slow':{ '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-12px) rotate(1.5deg)' } },
        'blob-drift-1': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(35px,-30px) scale(1.08)' },
          '66%': { transform: 'translate(-25px,20px) scale(0.94)' },
        },
        'blob-drift-2': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(-30px,35px) scale(1.06)' },
          '66%': { transform: 'translate(25px,-25px) scale(0.92)' },
        },
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
};
export default config;
