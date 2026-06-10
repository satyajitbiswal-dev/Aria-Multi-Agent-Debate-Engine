/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        advocate: {
          DEFAULT: '#ef4444',
          light: '#fef2f2',
          border: '#fca5a5',
        },
        critic: {
          DEFAULT: '#3b82f6',
          light: '#eff6ff',
          border: '#93c5fd',
        },
        judge: {
          DEFAULT: '#22c55e',
          light: '#f0fdf4',
          border: '#86efac',
        },
      },
      animation: {
        'pulse-dot': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
