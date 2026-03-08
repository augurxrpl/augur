// apps/api/src/index.ts
import express from "express";
import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { mountExtras } from "./mount_extras";
import { Client, isValidClassicAddress } from "xrpl";
import cors from "cors";

type Account = {
  id?: string;
  chain?: string;
  address?: string;
  label?: string;
  network?: string;
  status?: string;
};

const PORT = Number(process.env.PORT || "8787");
const HOST = String(process.env.AUGUR_BIND || process.env.HOST || "127.0.0.1");
const DATA_DIR = String(process.env.AUGUR_DATA_DIR || "/var/www/augur/data");
const ACCOUNTS_PATH = String(process.env.AUGUR_ACCOUNTS_PATH || path.join(DATA_DIR, "accounts.json"));

function nowIso() {
  return new Date().toISOString();
}

function safeReadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJsonFile(filePath: string, obj: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function asArrayAccounts(payload: any): Account[] {
  if (Array.isArray(payload)) return payload as Account[];
  if (payload && Array.isArray(payload.accounts)) return payload.accounts as Account[];
  return [];
}

function withId(a: Account, idx: number): Account {
  if (a.id) return a;
  const base = `${a.chain || "XRPL"}:${a.address || idx}`;
  return { ...a, id: base };
}

const app = express();
app.use(cors());

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  // minimal request log, no external deps
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  console.log(`[augur] ${nowIso()} ${req.method} ${req.url} ip=${ip}`);
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "augur-api", docs: "https://augurxrpl.com" });
});

let _xrplClient: Client | null = null;
let _xrplConn: Promise<Client> | null = null;

async function xrplClient(): Promise<Client> {
  if (_xrplClient) return _xrplClient;
  if (_xrplConn) return _xrplConn;

  _xrplConn = (async () => {
    const c = new Client("wss://s1.ripple.com");
    await c.connect();
    _xrplClient = c;
    _xrplConn = null;
    return c;
  })();

  return _xrplConn;
}

app.get("/api/statement", async (req: Request, res: Response) => {
  try {

    const address = String(req.query.address || "").trim();

    if (!address) {
      return res.status(400).json({ ok:false, error:"Missing address" });
    }

    if (!isValidClassicAddress(address)) {
      return res.status(400).json({ ok:false, error:"Invalid XRPL address" });
    }

    const c = await xrplClient();

    const ai:any = await c.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
      strict: true
    });

    const ad = ai.result.account_data;

    const drops = String(ad.Balance || "0");
    const xrp = (Number(drops)/1000000)
      .toFixed(6)
      .replace(/0+$/,"")
      .replace(/\.$/,"");

    let trustlines = 0;

    try {
      const al:any = await c.request({
        command:"account_lines",
        account:address,
        ledger_index:"validated",
        limit:200
      });

      trustlines = (al.result.lines || []).length;

    } catch {}

    let recentTxCount = 0;

    try {
      const tx:any = await c.request({
        command:"account_tx",
        account:address,
        ledger_index_min:-1,
        ledger_index_max:-1,
        limit:10
      });

      recentTxCount = (tx.result.transactions || []).length;

    } catch {}

    return res.json({
      ok:true,
      address,
      network:"XRPL",
      balanceXRP:xrp,
      sequence:Number(ad.Sequence),
      ownerCount:Number(ad.OwnerCount),
      trustlines,
      recentTxCount,
      statement:[
        `Wallet ${address} is active on XRPL.`,
        `Current XRP balance is ${xrp} XRP.`,
        `Sequence is ${ad.Sequence}. OwnerCount is ${ad.OwnerCount}.`,
        `Trustlines: ${trustlines}. Recent transactions sampled: ${recentTxCount}.`,
        `AUGUR is read-only. No keys. No custody.`
      ],
      source:{
        rippled:"wss://s1.ripple.com",
        ts:new Date().toISOString()
      }
    });

  } catch(e:any) {

    return res.status(500).json({
      ok:false,
      error:String(e?.message || e)
    });

  }
});

app.get("/api/classification", async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || "").trim();

    if (!address) {
      return res.status(400).json({ ok:false, error:"Missing address" });
    }

    if (!isValidClassicAddress(address)) {
      return res.status(400).json({ ok:false, error:"Invalid XRPL address" });
    }

    const c = await xrplClient();

    const ai:any = await c.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
      strict: true
    });

    const ad = ai.result.account_data;
    const drops = String(ad.Balance || "0");
    const balanceXRP = (Number(drops)/1000000)
      .toFixed(6)
      .replace(/0+$/,"")
      .replace(/\.$/,"");

    let trustlines = 0;
    try {
      const al:any = await c.request({
        command:"account_lines",
        account:address,
        ledger_index:"validated",
        limit:200
      });
      trustlines = (al.result.lines || []).length;
    } catch {}

    let recentTxCount = 0;
    try {
      const tx:any = await c.request({
        command:"account_tx",
        account:address,
        ledger_index_min:-1,
        ledger_index_max:-1,
        limit:10
      });
      recentTxCount = (tx.result.transactions || []).length;
    } catch {}

    const ownerCount = Number(ad.OwnerCount || 0);
    const balanceNum = Number(balanceXRP || "0");

    let classification = "Active Wallet";
    let confidence = 60;
    let activityLevel = recentTxCount >= 8 ? "High" : recentTxCount >= 3 ? "Medium" : "Low";

    if (recentTxCount === 0) {
      classification = "Dormant Wallet";
      confidence = 88;
      activityLevel = "Low";
    } else if (trustlines >= 5) {
      classification = "Builder-Style Wallet";
      confidence = 74;
    } else if (ownerCount > 0 && trustlines > 1) {
      classification = "Liquidity-Style Wallet";
      confidence = 71;
    } else if (balanceNum > 0 && trustlines > 0 && recentTxCount > 0) {
      classification = "Accumulator";
      confidence = 76;
    }

    const summary:string[] = [];

    if (classification === "Dormant Wallet") {
      summary.push("This wallet appears mostly inactive right now.");
      summary.push("Recent transaction activity is minimal or absent.");
    } else if (classification === "Builder-Style Wallet") {
      summary.push("This wallet shows broader XRPL participation across multiple trustlines.");
      summary.push("Behavior leans toward active ecosystem usage.");
    } else if (classification === "Liquidity-Style Wallet") {
      summary.push("This wallet shows signs consistent with asset and ledger-object participation.");
      summary.push("Behavior may include liquidity or structured XRPL usage.");
    } else if (classification === "Accumulator") {
      summary.push("This wallet appears active on XRPL.");
      summary.push("Behavior currently leans toward accumulation or active holding.");
    } else {
      summary.push("This wallet is active and participating on XRPL.");
      summary.push("Behavior is mixed based on the current signal set.");
    }

    if (trustlines > 0) {
      summary.push("Trustline count suggests participation beyond XRP alone.");
    }

    summary.push("AUGUR is read-only. No keys. No custody.");

    return res.json({
      ok:true,
      address,
      classification,
      confidence,
      activityLevel,
      signals:{
        recentTxCount,
        trustlines,
        ownerCount,
        balanceXRP
      },
      summary,
      source:{
        rippled:"wss://s1.ripple.com",
        ts:new Date().toISOString()
      }
    });

  } catch(e:any) {
    return res.status(500).json({
      ok:false,
      error:String(e?.message || e)
    });
  }
});

// core health
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "augur-api",
    ts: nowIso(),
    bind: HOST,
    port: PORT,
  });
});

// accounts
app.get("/api/accounts", (_req: Request, res: Response) => {
  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);
  res.json(accounts);
});

// all accounts, same as accounts for now but kept for compatibility
app.get("/api/accounts/all", (_req: Request, res: Response) => {
  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);
  res.json(accounts);
});

// add account
app.post("/api/accounts", (req: Request, res: Response) => {
  const incoming = (req.body || {}) as Account;

  if (!incoming.address) {
    res.status(400).json({ ok: false, error: "missing address" });
    return;
  }

  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);

  const next: Account = withId(
    {
      chain: incoming.chain || "XRPL",
      address: incoming.address,
      label: incoming.label || "",
      network: incoming.network || "mainnet",
      status: incoming.status || "active",
    },
    accounts.length
  );

  const exists = accounts.some(
    (a) => (a.chain || "XRPL") === next.chain && String(a.address) === String(next.address)
  );

  if (!exists) {
    accounts.push(next);
    safeWriteJsonFile(ACCOUNTS_PATH, accounts);
  }

  res.json({ ok: true, account: next, existed: exists });
});

// pause or resume by id
app.post("/api/accounts/:id/pause", (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);

  let found = false;
  const updated = accounts.map((a) => {
    if (String(a.id) === id) {
      found = true;
      return { ...a, status: "paused" };
    }
    return a;
  });

  if (!found) {
    res.status(404).json({ ok: false, error: "not found" });
    return;
  }

  safeWriteJsonFile(ACCOUNTS_PATH, updated);
  res.json({ ok: true });
});

app.post("/api/accounts/:id/resume", (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);

  let found = false;
  const updated = accounts.map((a) => {
    if (String(a.id) === id) {
      found = true;
      return { ...a, status: "active" };
    }
    return a;
  });

  if (!found) {
    res.status(404).json({ ok: false, error: "not found" });
    return;
  }

  safeWriteJsonFile(ACCOUNTS_PATH, updated);
  res.json({ ok: true });
});

// delete by id
app.delete("/api/accounts/:id", (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  const raw = safeReadJsonFile<any>(ACCOUNTS_PATH, []);
  const accounts = asArrayAccounts(raw).map(withId);

  const kept = accounts.filter((a) => String(a.id) !== id);

  if (kept.length === accounts.length) {
    res.status(404).json({ ok: false, error: "not found" });
    return;
  }

  safeWriteJsonFile(ACCOUNTS_PATH, kept);
  res.json({ ok: true });
});

// mount extras safely
void mountExtras(app);

// last resort error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.log("[augur] unhandled error", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, HOST, () => {
  console.log(`[augur] listening http://${HOST}:${PORT}`);
});
