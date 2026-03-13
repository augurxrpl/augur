import type { WalletRead } from "./xrplReader";

export type ActivityLevel = "High" | "Medium" | "Low";

export type ActivityResult = {
  level: ActivityLevel;
  sampledRecentTransactions: number;
  summary: string[];
};

export function buildActivity(wallet: WalletRead): ActivityResult {
  let level: ActivityLevel = "Low";

  if (wallet.recentTxCount >= 8) level = "High";
  else if (wallet.recentTxCount >= 3) level = "Medium";

  const summary: string[] = [];

  if (level === "High") {
    summary.push("Recent transaction flow is high in the sampled window.");
  } else if (level === "Medium") {
    summary.push("Recent transaction flow is moderate in the sampled window.");
  } else {
    summary.push("Recent transaction flow is light in the sampled window.");
  }

  if (wallet.trustlines > 0) {
    summary.push(`Trustline participation is ${wallet.trustlines > 10 ? "broad" : "present"}.`);
  }

  return {
    level,
    sampledRecentTransactions: wallet.recentTxCount,
    summary
  };
}
