import type { Express } from "express";
import { Router } from "express";
import { getNewsFeed } from "./news/newsFeed";

export const routesExtras = Router();

routesExtras.get("/extras/health", (_req, res) => {
  res.json({ ok: true, service: "augur-api", extras: true });
});

routesExtras.get("/api/news", async (req, res) => {
  try {
    const force = String(req.query.force || "") === "1";
    const payload = await getNewsFeed(force);
    res.json(payload);
  } catch (error: any) {
    console.error("[augur] /api/news failed", error);
    res.status(500).json({
      ok: false,
      error: String(error?.message || error || "news feed failed")
    });
  }
});

export function registerRoutesExtras(app: Express) {
  app.use(routesExtras);
}

export default routesExtras;
