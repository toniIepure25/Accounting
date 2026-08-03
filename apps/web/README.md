# apps/web — acces web opțional (PWA)

Ținta web **opțională** din plan. Reutilizează exact aceeași aplicație React din
[`packages/ui`](../../packages/ui); nu există cod separat de UI.

- Build: `npm run build:web` (rulează `vite build` în `@gr/ui`, ieșirea în `packages/ui/dist`).
- Deploy: se servește `packages/ui/dist` ca site static (orice CDN / server).
- PWA: în fază ulterioară se adaugă `vite-plugin-pwa` (manifest + service worker) pentru
  instalare din browser și cache offline.

Pentru că web-ul folosește același UI și același `@gr/core-domain`/`@gr/fiscal-ro`, o
modificare fiscală/legislativă se face o singură dată și se propagă la desktop, mobil și web.

> Notă: pnpm rămâne o alternativă validă (repo-ul are și `pnpm-workspace.yaml`); implicit
> folosim npm workspaces pentru zero dependențe suplimentare de mediu.
