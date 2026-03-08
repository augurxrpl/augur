// apps/api/src/routes_extras.ts
import type { Express } from "express";
import { Router } from "express";

export const routesExtras = Router();

routesExtras.get("/extras/health", (_req, res) => {
  res.json({ ok: true, service: "augur-api", extras: true });
});

export function registerRoutesExtras(app: Express) {
  app.use(routesExtras);
}

export default routesExtras;
