# Iconițe aplicație

Fișierele de iconițe (`32x32.png`, `128x128.png`, `icon.icns`, `icon.ico`) se generează
automat dintr-un logo sursă (PNG 1024×1024), cu:

```bash
npm run tauri -w @gr/desktop -- icon ./logo.png
```

Comanda produce toate dimensiunile/formatele cerute de Windows, macOS și Linux în acest
folder. Nu sunt versionate până nu există un logo final.
