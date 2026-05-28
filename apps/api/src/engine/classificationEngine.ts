import type { WalletRead } from "./xrplReader";
import type { ExtractedSignals } from "./signalExtractor";
import type { ActivityResult } from "./activityEngine";

export type ClassificationResult = {
  classification: string;
  confidence: number;
  identitySignals: string[];
  summary: string[];
};

export function classifyWallet(
  wallet: WalletRead,
  extracted: ExtractedSignals,
  activity: ActivityResult
): ClassificationResult {
  const { derived } = extracted;
  const identitySignals: string[] = [];
  const summary: string[] = [];

  if (derived.blackholeTier === "confirmed") {
    identitySignals.push("blackholeStatus");
    if (derived.issuerLike) identitySignals.push("issuerLike");
    summary.push("Top-priority blackhole override detected.");
    summary.push(
      derived.issuerLike
        ? "Wallet matches a confirmed blackholed issuer pattern."
        : "Wallet matches a confirmed blackholed wallet pattern."
    );
    return {
      classification: derived.issuerLike ? "Blackholed Issuer" : "Confirmed Blackholed Wallet",
      confidence: derived.issuerLike ? 95 : 92,
      identitySignals,
      summary
    };
  }

  if (derived.blackholeTier === "likely" && derived.issuerLike) {
    identitySignals.push("issuerLike");
    summary.push("Wallet matches a likely blackholed issuer pattern.");
    return {
      classification: "Likely Blackholed Issuer",
      confidence: 88,
      identitySignals,
      summary
    };
  }

  if (derived.blackholeTier === "partial" && derived.issuerLike) {
    identitySignals.push("issuerLike");
    summary.push("Wallet shows partial blackhole characteristics for an issuer-style account.");
    return {
      classification: "Issuer Wallet",
      confidence: 84,
      identitySignals,
      summary
    };
  }

  if (derived.issuerLike) {
    identitySignals.push("issuerLike");
    summary.push("Trustline density suggests issuer-style behavior.");
    return {
      classification: "Issuer Wallet",
      confidence: 84,
      identitySignals,
      summary
    };
  }

  if (derived.exchangeLike) {
    identitySignals.push("exchangeLike");
    summary.push("High balance and heavy transaction flow suggest exchange-style behavior.");
    return {
      classification: "Exchange-Style Wallet",
      confidence: 67,
      identitySignals,
      summary
    };
  }

  if (derived.liquidityLike) {
    identitySignals.push("liquidityLike");
    summary.push("Owner objects and trustlines suggest liquidity-style behavior.");
    return {
      classification: "Liquidity-Style Wallet",
      confidence: 71,
      identitySignals,
      summary
    };
  }

  if (derived.builderLike) {
    identitySignals.push("builderLike");
    summary.push("Trustline participation and recent use suggest active ecosystem behavior.");
    return {
      classification: "Builder-Style Wallet",
      confidence: 74,
      identitySignals,
      summary
    };
  }

  if (derived.accumulatorLike) {
    identitySignals.push("accumulatorLike");
    summary.push("Balance, trustline participation, and recent use suggest accumulation behavior.");
    return {
      classification: "Accumulator",
      confidence: activity.level === "High" ? 78 : 76,
      identitySignals,
      summary
    };
  }

  if (derived.dormantLike) {
    identitySignals.push("dormantLike");
    summary.push("No recent sampled transactions were detected.");
    return {
      classification: "Dormant Wallet",
      confidence: 88,
      identitySignals,
      summary
    };
  }

  summary.push("Wallet is active but does not yet match a stronger Phase 2 identity profile.");
  return {
    classification: "Active Wallet",
    confidence: 60,
    identitySignals,
    summary
  };
}
