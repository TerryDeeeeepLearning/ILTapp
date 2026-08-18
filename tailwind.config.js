/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    'rgb(var(--c-base) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised:  'rgb(var(--c-raised) / <alpha-value>)',
        line:    'rgb(var(--c-line) / <alpha-value>)',
        ink:     'rgb(var(--c-ink) / <alpha-value>)',
        muted:   'rgb(var(--c-muted) / <alpha-value>)',
        faint:   'rgb(var(--c-faint) / <alpha-value>)',
        accent:  'rgb(var(--c-accent) / <alpha-value>)',
        ok:      'rgb(var(--c-ok) / <alpha-value>)',
        bad:     'rgb(var(--c-bad) / <alpha-value>)',
        hint:    'rgb(var(--c-hint) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Noto Sans TC', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      borderRadius: { xs: '3px' }
    }
  },
  plugins: []
};
