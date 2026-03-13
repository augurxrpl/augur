import type { WalletRead } from "./xrplReader";
import type { ClassificationResult } from "./classificationEngine";
import type { ActivityResult } from "./activityEngine";
import type { RiskResult } from "./riskEngine";
import type { ExtractedSignals } from "./signalExtractor";

export function buildStatement(
  wallet: WalletRead,
  classification: ClassificationResult,
  activity: ActivityResult,
  risk: RiskResult,
  extracted: ExtractedSignals
): string[] {
  const out: string[] = [];

  out.push(`Wallet ${wallet.address} is classified as ${classification.classification}.`);

  if (classification.classification === "Blackholed Issuer") {
    out.push("This wallet appears to be an issuer account with blackhole characteristics.");
    out.push("Master key is disabled and the RegularKey points to a known blackhole address.");
    out.push("Trustline behavior suggests issuer usage rather than standard retail or builder activity.");
  } else if (classification.classification === "Issuer Wallet") {
    out.push("This wallet shows issuer-style trustline behavior.");
    out.push("The public ledger pattern is stronger than a generic ecosystem or retail wallet label.");
  }

  else if (classification.classification === "Builder-Style Wallet") {
    out.push("This wallet looks active in the XRPL ecosystem with trustline participation.");
  } else if (classification.classification === "Liquidity-Style Wallet") {
    out.push("Owner objects and trustline behavior suggest liquidity-style usage.");
  } else if (classification.classification === "Accumulator") {
    out.push("This wallet shows signs of accumulation with recent XRPL activity.");
  } else if (classification.classification === "Dormant Wallet") {
    out.push("This wallet appears mostly inactive in the recent sampled window.");
  } else {
    out.push("This wallet is active but does not yet match a stronger Phase 2 identity profile.");
  }

  out.push(`Current XRP balance is ${wallet.balanceXRP} XRP.`);
  out.push(`Sequence is ${wallet.sequence}. OwnerCount is ${wallet.ownerCount}.`);
  out.push(`Trustlines: ${wallet.trustlines}. Recent transactions sampled: ${wallet.recentTxCount}.`);
  out.push(`Activity level is ${activity.level}. Confidence is ${classification.confidence}.`);

  if (risk.flags.length > 0) {
    out.push(`Risk flags: ${risk.flags.join(", ")}.`);
  }

  if (extracted.derived.blackholeStatus) {
    out.push("AUGUR detected a top-tier issuer-state override before applying generic behavior labels.");
  }

  out.push("AUGUR is read-only. No keys. No custody.");

  return out;
}
