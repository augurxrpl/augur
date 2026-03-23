import { Client } from "xrpl";
import { summarizeTransaction } from "./txSummary";

export const XRPL_URL = process.env.AUGUR_XRPL_URL || "wss://s1.ripple.com";

const LSF_DISABLE_MASTER = 0x00100000;

const KNOWN_BLACKHOLE_ADDRESSES = new Set<string>([
  "rrrrrrrrrrrrrrrrrrrrrhoLvTp",
  "rrrrrrrrrrrrrrrrrrrrBZbvji"
]);

let cachedClient: Client | null = null;
let pendingClient: Promise<Client> | null = null;

export type WalletRead = {
  address: string;
  network: "XRPL";
  balanceXRP: string;
  tokenHoldings: Array<{ currency: string; issuer: string; balance: string; limit: string }>;
  transactionBreakdown: Array<{ hash: string; timestamp: number | null; type: string; result: string; summary: string; amount: string | null; currency: string | null; issuer: string | null; counterparty: string | null }>;
  balanceDrops: string;
  sequence: number;
  ownerCount: number;
  trustlines: number;
  recentTxCount: number;
  flags: number;
  masterKeyDisabled: boolean;
  regularKey: string | null;
  regularKeyLooksBlackholed: boolean;
};

async function getClient(): Promise<Client> {
  if (cachedClient && cachedClient.isConnected()) return cachedClient;
  if (pendingClient) return pendingClient;

  pendingClient = (async () => {
    if (cachedClient) {
      try {
        if (cachedClient.isConnected()) {
          await cachedClient.disconnect();
        }
      } catch {}
      cachedClient = null;
    }

    const client = new Client(XRPL_URL);

    client.on("disconnected", () => {
      if (cachedClient === client) cachedClient = null;
    });

    await client.connect();
    cachedClient = client;
    pendingClient = null;
    return client;
  })();

  try {
    return await pendingClient;
  } catch (err) {
    pendingClient = null;
    throw err;
  }
}

function formatXrp(drops: string): string {
  return (Number(drops) / 1_000_000)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

async function readTokenHoldings(client: Client, address: string): Promise<Array<{ currency: string; issuer: string; balance: string; limit: string }>> {
  let out: Array<{ currency: string; issuer: string; balance: string; limit: string }> = [];
  let marker: unknown = undefined;
  let pages = 0;

  while (pages < 20) {
    const result: any = await client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated",
      limit: 400,
      marker
    });

    const lines = Array.isArray(result?.result?.lines) ? result.result.lines : [];
    out.push(
      ...lines
        .filter((line: any) => Number(line?.balance || 0) !== 0)
        .map((line: any) => ({
          currency: String(line?.currency || ""),
          issuer: String(line?.account || ""),
          balance: String(line?.balance || "0"),
          limit: String(line?.limit || "0")
        }))
    );

    if (!result?.result?.marker) break;
    marker = result.result.marker;
    pages += 1;
  }

  return out;
}


async function readTrustlineCount(client: Client, address: string): Promise<number> {
  let count = 0;
  let marker: unknown = undefined;
  let pages = 0;

  while (pages < 20) {
    const result: any = await client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated",
      limit: 400,
      marker
    });

    const lines = Array.isArray(result?.result?.lines) ? result.result.lines : [];
    count += lines.length;

    if (!result?.result?.marker) break;
    marker = result.result.marker;
    pages += 1;
  }

  return count;
}

async function readTransactionBreakdown(client: Client, address: string) {
  const result: any = await client.request({
    command: "account_tx",
    account: address,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 20
  });

  const arr = Array.isArray(result?.result?.transactions) ? result.result.transactions : [];
  return arr.map((entry: any) => summarizeTransaction(entry?.tx || entry?.tx_json || entry || {}, entry?.meta || entry?.metaData || {}, entry));
}

async function readRecentTxCount(client: Client, address: string): Promise<number> {
  const result: any = await client.request({
    command: "account_tx",
    account: address,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 10
  });

  return Array.isArray(result?.result?.transactions)
    ? result.result.transactions.length
    : 0;
}

export async function readWallet(address: string): Promise<WalletRead> {
  const client = await getClient();

  const info: any = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
    strict: true
  });

  const accountData = info?.result?.account_data || {};
  const balanceDrops = String(accountData.Balance || "0");
  const flags = Number(accountData.Flags || 0);
  const regularKey =
    typeof accountData.RegularKey === "string" && accountData.RegularKey.trim()
      ? accountData.RegularKey.trim()
      : null;

  const masterKeyDisabled = (flags & LSF_DISABLE_MASTER) === LSF_DISABLE_MASTER;
  const regularKeyLooksBlackholed =
    !!regularKey && KNOWN_BLACKHOLE_ADDRESSES.has(regularKey);

  let trustlines = 0;
  let recentTxCount = 0;
  let tokenHoldings: Array<{ currency: string; issuer: string; balance: string; limit: string }> = [];
  let transactionBreakdown: Array<{ hash: string; timestamp: number | null; type: string; result: string; summary: string; amount: string | null; currency: string | null; issuer: string | null; counterparty: string | null }> = [];

  try {
    trustlines = await readTrustlineCount(client, address);
    tokenHoldings = await readTokenHoldings(client, address);
  } catch {
    trustlines = 0;
    tokenHoldings = [];
  }

  try {
    recentTxCount = await readRecentTxCount(client, address);
    transactionBreakdown = await readTransactionBreakdown(client, address);
  } catch {
    recentTxCount = 0;
    transactionBreakdown = [];
  }

  return {
    address,
    network: "XRPL",
    balanceXRP: formatXrp(balanceDrops),
    balanceDrops,
    sequence: Number(accountData.Sequence || 0),
    ownerCount: Number(accountData.OwnerCount || 0),
    trustlines,
    recentTxCount,
    flags,
    masterKeyDisabled,
    regularKey,
    regularKeyLooksBlackholed,
    tokenHoldings,
    transactionBreakdown
  };
}
