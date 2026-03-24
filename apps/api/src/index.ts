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

  app.get("/api/subscription/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      area: "subscription",
      status: "skeleton-live",
      message: "Subscription route skeleton is live",
      implemented: false
    });
  });

  app.get("/api/subscription/quote", (req: Request, res: Response) => {
    const requestedTierId =
      typeof req.query.tierId === "string" ? req.query.tierId.trim().toLowerCase() : "";
    const tier = getTierById(requestedTierId);
    if (!tier) {
      return res.status(400).json({
        ok: false,
        area: "subscription",
        error: "Invalid tier",
        message: "Valid tierId values are foundation, pro, enterprise"
      });
    }
    return res.status(501).json({
      ok: false,
      area: "subscription",
      error: "Not implemented",
      message: "Subscription quoting is not implemented yet",
      quote: {
        tierId: tier.tierId,
        tierName: tier.tierName,
        monthlyUsd: tier.monthlyUsd,
        annualUsd: tier.annualUsd,
        xrpQuote: null,
        drops: null,
        pricingSource: null,
        quotedAt: new Date().toISOString(),
        expiresAt: null,
        implemented: false
      }
    });
  });

  app.get("/api/subscription/status", (req: Request, res: Response) => {
    const requestedTierId =
      typeof req.query.tierId === "string" ? req.query.tierId.trim().toLowerCase() : "";
    const tier = getTierById(requestedTierId);
    if (!tier && requestedTierId) {
      return res.status(400).json({
        ok: false,
        area: "subscription",
        error: "Invalid tier",
        message: "Valid tierId values are foundation, pro, enterprise"
      });
    }
    return res.status(501).json({
      ok: false,
      area: "subscription",
      error: "Not implemented",
      message: "Subscription status is not implemented yet",
      subscription: tier ? {
        tierId: tier.tierId,
        tierName: tier.tierName,
        walletLimit: tier.walletLimit,
        reportDepth: tier.reportDepth,
        historyDepth: tier.historyDepth,
        exportAccess: tier.exportAccess,
        apiAccess: tier.apiAccess,
        prioritySupport: tier.prioritySupport,
        featureFlags: tier.featureFlags,
        status: tier.status,
        active: false,
        renewalAt: null,
        expiresAt: null,
        implemented: false
      } : null
    });
  });
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

start();type SubscriptionTier = {
  tierId: string;
  tierName: string;
  monthlyUsd: number;
  annualUsd: number | null;
  walletLimit: number;
  reportDepth: string;
  historyDepth: string;
  exportAccess: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  featureFlags: string[];
  status: "active" | "planned";
};

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  { tierId: "foundation", tierName: "Foundation", monthlyUsd: 29, annualUsd: 290, walletLimit: 5, reportDepth: "standard", historyDepth: "30d", exportAccess: false, apiAccess: false, prioritySupport: false, featureFlags: ["wallet_reports","classification","blackhole_signals","token_holdings","recent_transactions"], status: "active" },
  { tierId: "pro", tierName: "Pro", monthlyUsd: 99, annualUsd: 990, walletLimit: 25, reportDepth: "extended", historyDepth: "90d", exportAccess: true, apiAccess: false, prioritySupport: true, featureFlags: ["wallet_reports","classification","blackhole_signals","token_holdings","recent_transactions","extended_breakdowns","csv_exports","saved_wallets"], status: "planned" },
  { tierId: "enterprise", tierName: "Enterprise", monthlyUsd: 499, annualUsd: null, walletLimit: 250, reportDepth: "full", historyDepth: "365d", exportAccess: true, apiAccess: true, prioritySupport: true, featureFlags: ["wallet_reports","classification","blackhole_signals","token_holdings","recent_transactions","extended_breakdowns","csv_exports","saved_wallets","api_access","team_access"], status: "planned" }
];

function getTierById(tierId: string | undefined) {
  if (!tierId) return null;
  return SUBSCRIPTION_TIERS.find((tier) => tier.tierId === tierId) ?? null;
}


