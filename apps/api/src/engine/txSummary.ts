export function summarizeTransaction(tx: any, meta: any, entry: any = {}) {
  const type = String(tx?.TransactionType || tx?.tx?.TransactionType || tx?.tx_json?.TransactionType || "Unknown");
  const result = String(meta?.TransactionResult || tx?.meta?.TransactionResult || "unknown");
  const hash = String(tx?.hash || tx?.Hash || tx?.transaction_hash || entry?.hash || entry?.Hash || entry?.tx_json?.hash || entry?.tx_json?.Hash || "");
  const timestamp = tx?.date ?? null;
  let summary = `${type} transaction detected.`;
  let amount = null;
  let currency = null;
  let issuer = null;
  let counterparty = null;
  if (type === "Payment") {
    const destination = tx?.Destination || null;
    counterparty = destination;
    const amt = tx?.Amount;
    if (typeof amt === "string") {
      amount = String(Number(amt) / 1000000);
      currency = "XRP";
      summary = `Sent ${amount} XRP to ${destination || "another wallet"}.`;
    } else if (amt && typeof amt === "object") {
      amount = String(amt.value ?? "");
      currency = String(amt.currency ?? "");
      issuer = String(amt.issuer ?? "");
      summary = `Sent ${amount} ${currency} to ${destination || "another wallet"}.`;
    } else {
      summary = `Payment sent to ${destination || "another wallet"}.`;
    }
  } else if (type === "TrustSet") {
    const limit = tx?.LimitAmount;
    currency = limit?.currency ? String(limit.currency) : null;
    issuer = limit?.issuer ? String(limit.issuer) : null;
    amount = limit?.value ? String(limit.value) : null;
    summary = `Updated trustline${currency ? ` for ${currency}` : ""}${issuer ? ` issued by ${issuer}` : ""}.`;
  } else if (type === "OfferCreate") {
    summary = "Placed a DEX order on the XRPL.";
  } else if (type === "OfferCancel") {
    summary = "Canceled a prior DEX order.";
  } else if (type === "AccountSet") {
    summary = "Changed wallet configuration settings.";
  } else if (type === "SetRegularKey") {
    summary = "Changed wallet signing authority.";
  } else if (type === "AMMDeposit") {
    summary = "Added liquidity to an XRPL AMM pool.";
  } else if (type === "AMMWithdraw") {
    summary = "Removed liquidity from an XRPL AMM pool.";
  } else if (type === "AMMVote") {
    summary = "Changed XRPL AMM fee vote settings.";
  } else if (type === "EscrowCreate") {
    summary = "Locked funds into escrow.";
  } else if (type === "EscrowFinish") {
    summary = "Released escrowed funds.";
  } else if (type === "CheckCreate") {
    summary = "Created an XRPL check.";
  } else if (type === "CheckCash") {
    summary = "Cashed an XRPL check.";
  } else if (type === "NFTokenMint") {
    summary = "Minted an NFT on XRPL.";
  } else if (type === "NFTokenCreateOffer") {
    summary = "Created an NFT offer.";
  } else if (type === "NFTokenAcceptOffer") {
    summary = "Accepted an NFT offer.";
  }
  return {
    hash,
    timestamp,
    type,
    result,
    summary,
    amount,
    currency,
    issuer,
    counterparty,
  };
}
