import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { mountExtras } from "./mount_extras";
import { buildReport } from "./engine/reportEngine";
import { XRPL_URL } from "./engine/xrplReader";
import { errorBody, okSource, nowIso } from "./utils/response";
import { getAddressValidationError, normalizeAddress } from "./utils/validateAddress";

const PORT = Number(process.env.PORT || "8787");
const HOST = String(process.env.AUGUR_BIND || process.env.HOST || "127.0.0.1");
const VERSION = process.env.AUGUR_VERSION || "phase2-report-engine-v1";

const app = express();

app.use(cors());
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  console.log(`[augur] ${nowIso()} ${req.method} ${req.url} ip=${ip}`);
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "augur-api",
    docs: "https://augurxrpl.com",
    source: okSource(XRPL_URL)
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "augur-api",
    bind: HOST,
    port: PORT,
    source: okSource(XRPL_URL)
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "augur-api",
    bind: HOST,
    port: PORT,
    source: okSource(XRPL_URL)
  });
});

app.get("/api/version", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "augur-api",
    version: VERSION,
    source: okSource(XRPL_URL)
  });
});

async function loadReport(req: Request, res: Response) {
  const address = normalizeAddress(req.query.address);
  const validationError = getAddressValidationError(address);

  if (validationError) {
    res.status(400).json(errorBody(validationError));
    return null;
  }

  try {
    return await buildReport(address);
  } catch (error: any) {
    console.error("[augur] buildReport failed", error);
    res.status(500).json(errorBody(String(error?.message || error)));
    return null;
  }
}

app.get("/api/report", async (req: Request, res: Response) => {
  const report = await loadReport(req, res);
  if (!report) return;
  res.json(report);
});

app.get("/api/classification", async (req: Request, res: Response) => {
  const report = await loadReport(req, res);
  if (!report) return;

  res.json({
    ok: true,
    address: report.address,
    network: report.network,
    classification: report.classification,
    confidence: report.confidence,
    activityLevel: report.activityLevel,
    blackholeStatus: report.blackholeStatus,
    issuerLike: report.issuerLike,
    identitySignals: report.identitySignals,
    summary: report.statement.slice(0, 3),
    source: report.source
  });
});

app.get("/api/statement", async (req: Request, res: Response) => {
  const report = await loadReport(req, res);
  if (!report) return;

  res.json({
    ok: true,
    address: report.address,
    network: report.network,
    classification: report.classification,
    confidence: report.confidence,
    statement: report.statement,
    source: report.source
  });
});

app.get("/api/activity", async (req: Request, res: Response) => {
  const report = await loadReport(req, res);
  if (!report) return;

  res.json({
    ok: true,
    address: report.address,
    network: report.network,
    activity: report.activity,
    activityLevel: report.activityLevel,
    recentTxCount: report.recentTxCount,
    source: report.source
  });
});

app.get("/api/risk", async (req: Request, res: Response) => {
  const report = await loadReport(req, res);
  if (!report) return;

  res.json({
    ok: true,
    address: report.address,
    network: report.network,
    classification: report.classification,
    blackholeStatus: report.blackholeStatus,
    risk: report.risk,
    source: report.source
  });
});

async function start() {
  try {
    await mountExtras(app);
  } catch (error) {
    console.error("[augur] mountExtras failed", error);
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json(errorBody("Not found"));
  });

  app.listen(PORT, HOST, () => {
    console.log(`[augur] listening on http://${HOST}:${PORT}`);
  });
}

start();
