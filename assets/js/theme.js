/* Applies the saved theme before first paint (kept as a file so the Content-Security-Policy can forbid inline scripts). */
try { var t = localStorage.getItem('iq-theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
