import { buildActivity } from "./activityEngine";
import { classifyWallet } from "./classificationEngine";
import { buildRisk } from "./riskEngine";
import { extractSignals } from "./signalExtractor";
import { buildStatement } from "./statementEngine";
import { readWallet, XRPL_URL } from "./xrplReader";
import { okSource } from "../utils/response";

export type FullReport = {
  ok: true;
  address: string;
  network: "XRPL";
  classification: string;
  confidence: number;
  activityLevel: "High" | "Medium" | "Low";
  balanceXRP: string;
  sequence: number;
  ownerCount: number;
  trustlines: number;
  recentTxCount: number;
  blackholeStatus: boolean;
  blackholeTier: "confirmed" | "likely" | "partial" | "none";
  issuerLike: boolean;
};

export type FullReportFlags = {
  masterKeyDisabled: boolean;
  regularKey: string | null;
  regularKeyLooksBlackholed: boolean;
};

export type FullReportSignal = {
  key: string;
  label: string;
  value: number | string | boolean | null;
  category: string;
  interpretation?: string;
};

export type FullReportActivity = {
  level: "High" | "Medium" | "Low";
  sampledRecentTransactions: number;
  summary: string[];
};

export type FullReportRisk = {
  level: "Low" | "Moderate" | "High";
  flags: string[];
  notes: string[];
};

export type FullReportSource = {
  rippled: string;
  ts: string;
};

export type FullReportBody = FullReport & {
  tokenHoldings: Array<{ currency: string; issuer: string; balance: string; limit: string }>;
  transactionBreakdown: Array<{ hash: string; timestamp: number | null; type: string; result: string; summary: string; amount: string | null; currency: string | null; issuer: string | null; counterparty: string | null }>;
  accountFlags: FullReportFlags;
  identitySignals: string[];
  signals: FullReportSignal[];
  activity: FullReportActivity;
  risk: FullReportRisk;
  statement: string[];
  source: FullReportSource;
};

export async function buildReport(address: string): Promise<FullReportBody> {
  const wallet = await readWallet(address);
  const extracted = extractSignals(wallet);
  const activity = buildActivity(wallet);
  const classification = classifyWallet(wallet, extracted, activity);
  const risk = buildRisk(wallet, extracted, classification);
  const statement = buildStatement(wallet, classification, activity, risk, extracted);

  return {
    ok: true,
    address: wallet.address,
    network: wallet.network,
    classification: classification.classification,
    confidence: classification.confidence,
    activityLevel: activity.level,
    balanceXRP: wallet.balanceXRP,
    sequence: wallet.sequence,
    ownerCount: wallet.ownerCount,
    trustlines: wallet.trustlines,
    recentTxCount: wallet.recentTxCount,
    blackholeStatus: extracted.derived.blackholeStatus,
    blackholeTier: extracted.derived.blackholeTier,
    issuerLike: extracted.derived.issuerLike,
    tokenHoldings: wallet.tokenHoldings,
    transactionBreakdown: wallet.transactionBreakdown,
    accountFlags: {
      masterKeyDisabled: wallet.masterKeyDisabled,
      regularKey: wallet.regularKey,
      regularKeyLooksBlackholed: wallet.regularKeyLooksBlackholed
    },
    identitySignals: classification.identitySignals,
    signals: extracted.signals.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      category: s.category,
      interpretation: s.interpretation
    })),
    activity,
    risk,
    statement,
    source: okSource(XRPL_URL)
  };
}
