import type { WalletRead } from "./xrplReader";
import type { ExtractedSignals } from "./signalExtractor";
import type { ClassificationResult } from "./classificationEngine";

export type RiskLevel = "Low" | "Moderate" | "High";

export type RiskResult = {
  level: RiskLevel;
  flags: string[];
  notes: string[];
};

export function buildRisk(
  wallet: WalletRead,
  extracted: ExtractedSignals,
  classification: ClassificationResult
): RiskResult {
  const flags: string[] = [];
  const notes: string[] = [];
  let level: RiskLevel = "Low";

  if (classification.classification === "Blackholed Issuer") {
    flags.push("issuer_account", "permanently_blackholed");
    notes.push("Issuer-state signal is strong and identity appears intentionally constrained.");
    level = "Low";
    return { level, flags, notes };
  }

  if (classification.classification === "Issuer Wallet") {
    flags.push("issuer_account");
    notes.push("Wallet shows issuer-style trustline behavior.");
    level = "Low";
  }

  if (wallet.recentTxCount === 0) {
    flags.push("inactive_sample_window");
    notes.push("No recent sampled transactions were detected.");
    level = level === "Low" ? "Moderate" : level;
  }

  if (wallet.trustlines === 0 && wallet.ownerCount === 0 && Number(wallet.balanceXRP || "0") === 0) {
    flags.push("minimal_public_signal");
    notes.push("Public wallet surface is thin, which reduces interpretation depth.");
    level = "Moderate";
  }

  if (wallet.masterKeyDisabled && !extracted.derived.blackholeStatus) {
    flags.push("master_key_disabled");
    notes.push("Master key is disabled but no known blackhole RegularKey was detected.");
    level = level === "Low" ? "Moderate" : level;
  }

  return { level, flags, notes };
}
