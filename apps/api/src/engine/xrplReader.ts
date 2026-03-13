import { Client } from "xrpl";

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
  if (cachedClient) return cachedClient;
  if (pendingClient) return pendingClient;

  pendingClient = (async () => {
    const client = new Client(XRPL_URL);
    await client.connect();
    cachedClient = client;
    pendingClient = null;
    return client;
  })();

  return pendingClient;
}

function formatXrp(drops: string): string {
  return (Number(drops) / 1_000_000)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
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

  try {
    trustlines = await readTrustlineCount(client, address);
  } catch {
    trustlines = 0;
  }

  try {
    recentTxCount = await readRecentTxCount(client, address);
  } catch {
    recentTxCount = 0;
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
    regularKeyLooksBlackholed
  };
}
