import type { WalletRead } from "./xrplReader";

export type SignalCategory =
  | "activity"
  | "portfolio"
  | "behavior"
  | "risk"
  | "identity";

export type SignalResult = {
  key: string;
  label: string;
  value: number | string | boolean | null;
  category: SignalCategory;
  scoreImpact: number;
  confidenceImpact: number;
  interpretation?: string;
};

export type DerivedSignals = {
  blackholeStatus: boolean;
  blackholeTier: "confirmed" | "likely" | "partial" | "none";
  issuerLike: boolean;
  liquidityLike: boolean;
  exchangeLike: boolean;
  builderLike: boolean;
  dormantLike: boolean;
  accumulatorLike: boolean;
};

export type ExtractedSignals = {
  signals: SignalResult[];
  derived: DerivedSignals;
};

export function extractSignals(wallet: WalletRead): ExtractedSignals {
  const balanceNum = Number(wallet.balanceXRP || "0");

  const blackholeStatus =
    wallet.masterKeyDisabled && wallet.regularKeyLooksBlackholed;

  const blackholeTier: "confirmed" | "likely" | "partial" | "none" =
    blackholeStatus
      ? "confirmed"
      : wallet.masterKeyDisabled
        ? (wallet.regularKey ? "partial" : "likely")
        : "none";

  const issuerLike =
    wallet.trustlines >= 20 ||
    (wallet.trustlines >= 10 && wallet.ownerCount === 0);

  const exchangeLike =
    balanceNum >= 250000 &&
    wallet.recentTxCount >= 10 &&
    wallet.trustlines <= 2 &&
    wallet.ownerCount <= 2;

  const liquidityLike =
    wallet.ownerCount > 0 &&
    wallet.trustlines > 1;

  const builderLike =
    wallet.trustlines >= 5 &&
    wallet.recentTxCount > 0;

  const dormantLike = wallet.recentTxCount === 0;

  const accumulatorLike =
    balanceNum > 0 &&
    wallet.trustlines > 0 &&
    wallet.recentTxCount > 0;

  const signals: SignalResult[] = [
    {
      key: "balanceXRP",
      label: "XRP Balance",
      value: wallet.balanceXRP,
      category: "portfolio",
      scoreImpact: balanceNum > 0 ? 4 : 0,
      confidenceImpact: 2,
      interpretation: `Wallet holds ${wallet.balanceXRP} XRP.`
    }
  ];

  signals.push({
    key: "recentTxCount",
    label: "Recent Transaction Sample",
    value: wallet.recentTxCount,
    category: "activity",
    scoreImpact: wallet.recentTxCount >= 8 ? 8 : wallet.recentTxCount >= 3 ? 4 : 1,
    confidenceImpact: wallet.recentTxCount > 0 ? 5 : 2,
    interpretation: `Sampled recent transaction count is ${wallet.recentTxCount}.`
  });

  signals.push({
    key: "trustlines",
    label: "Trustlines",
    value: wallet.trustlines,
    category: "behavior",
    scoreImpact: wallet.trustlines >= 10 ? 8 : wallet.trustlines > 0 ? 4 : 0,
    confidenceImpact: wallet.trustlines > 0 ? 5 : 1,
    interpretation: `Wallet has ${wallet.trustlines} trustlines.`
  });

  signals.push({
    key: "ownerCount",
    label: "Owner Objects",
    value: wallet.ownerCount,
    category: "behavior",
    scoreImpact: wallet.ownerCount > 0 ? 4 : 0,
    confidenceImpact: 3,
    interpretation: `Wallet has ${wallet.ownerCount} owner objects.`
  });

  signals.push({
    key: "masterKeyDisabled",
    label: "Master Key Disabled",
    value: wallet.masterKeyDisabled,
    category: "identity",
    scoreImpact: wallet.masterKeyDisabled ? 10 : 0,
    confidenceImpact: wallet.masterKeyDisabled ? 10 : 0,
    interpretation: wallet.masterKeyDisabled
      ? "Master key is disabled."
      : "Master key is not disabled."
  });

  signals.push({
    key: "regularKey",
    label: "Regular Key",
    value: wallet.regularKey,
    category: "identity",
    scoreImpact: wallet.regularKey ? 2 : 0,
    confidenceImpact: wallet.regularKey ? 3 : 0,
    interpretation: wallet.regularKey
      ? `RegularKey is set to ${wallet.regularKey}.`
      : "No RegularKey is set."
  });

  signals.push({
    key: "blackholeStatus",
    label: "Blackhole Status",
    value: blackholeStatus,
    category: "identity",
    scoreImpact: blackholeTier === "confirmed" ? 25 : blackholeTier === "likely" ? 18 : blackholeTier === "partial" ? 10 : 0,
    confidenceImpact: blackholeTier === "confirmed" ? 20 : blackholeTier === "likely" ? 12 : blackholeTier === "partial" ? 8 : 0,
    interpretation:
      blackholeTier === "confirmed"
        ? "Master key is disabled and RegularKey points to a known blackhole address."
        : blackholeTier === "likely"
          ? "Master key is disabled and no RegularKey is set. This looks like a likely blackhole pattern."
          : blackholeTier === "partial"
            ? "Master key is disabled, but RegularKey does not match a known blackhole address."
            : "No definitive blackhole pattern detected."
  });

  signals.push({
    key: "issuerLike",
    label: "Issuer-Like Pattern",
    value: issuerLike,
    category: "identity",
    scoreImpact: issuerLike ? 15 : 0,
    confidenceImpact: issuerLike ? 10 : 0,
    interpretation: issuerLike
      ? "Trustline pattern suggests issuer-style behavior."
      : "No strong issuer-style trustline pattern detected."
  });

  return {
    signals,
    derived: {
      blackholeStatus,
      blackholeTier,
      issuerLike,
      liquidityLike,
      exchangeLike,
      builderLike,
      dormantLike,
      accumulatorLike
    }
  };
}
