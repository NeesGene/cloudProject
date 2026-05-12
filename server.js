const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  const timestamp = new Date().toLocaleString();
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Hetzner SSR Project</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Geleverd via GitHub & Docker</h1>
        <p>Dit is een <strong>Server-Side Rendered</strong> pagina.</p>
        <p>Gegenereerd op de VPS op: 12/05/2026, 15:45:12</p>
        <hr>
        <p>Status: <span style="color: green;">Online (HTTPS)</span></p>
      </body>
    </html>
  `);
});

app.listen(port, () => console.log(`App draait op poort ${port}`));
