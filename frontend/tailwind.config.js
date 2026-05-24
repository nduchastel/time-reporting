// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'action-in': '#00897b',
        'action-out': '#28a745',
        'action-hours': '#0288d1',
        'action-off': '#f57c00',
      }
    },
  },
  plugins: [],
}
