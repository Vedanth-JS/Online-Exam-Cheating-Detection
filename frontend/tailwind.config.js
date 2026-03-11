module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
       colors: {
         navy: {
           900: '#0a0f1c',
           800: '#111827',
           700: '#1e293b'
         },
         alert: {
           red: '#ef4444',
           darkred: '#7f1d1d'
         }
       }
    },
  },
  plugins: [],
}
