import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // SSR everything: parameterized routes (/tire/:id, /order/:id, /brands/:id)
  // cannot be prerendered without param discovery; static prerender list can be
  // reintroduced for "/" and "/catalog" in the SEO pass (spec 08).
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
