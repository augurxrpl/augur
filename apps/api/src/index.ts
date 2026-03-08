// apps/api/src/index.ts
import express from "express";
import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { mountExtras } from "./mount_extras";

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

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  // minimal request log, no external deps
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  console.log(`[augur] ${nowIso()} ${req.method} ${req.url} ip=${ip}`);
  next();
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
