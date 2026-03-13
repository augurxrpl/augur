import type { Express } from "express";
import { CONFIG } from "./config.js";
import {
  ensureVault,
  readAccounts,
  addAccount,
  setAccountStatus,
  purgeDeletedAccounts
} from "./vault/writer.js";

// This file is intentionally not the canonical intelligence router.
// Live wallet intelligence routes are defined in src/index.ts.
// If this file is mounted later, it should only handle vault/account utilities.

export function routes(app: Express) {
  app.get("/api/accounts", async (req, res) => {
    await ensureVault(CONFIG.vaultPath);
    const accounts = await readAccounts(CONFIG.vaultPath);

    const all = String(req.query.all || "") === "1";
    const out = all ? accounts : accounts.filter((a: any) => a.status === "active");

    res.json({ ok: true, accounts: out });
  });

  app.post("/api/accounts", async (req, res) => {
    const { type, chain, label, address_or_identifier, network } = req.body || {};

    if (!type || !chain || !label || !address_or_identifier) {
      return res.status(400).json({
        ok: false,
        error: "missing fields: type, chain, label, address_or_identifier"
      });
    }

    await ensureVault(CONFIG.vaultPath);

    const account = await addAccount(CONFIG.vaultPath, {
      type,
      chain,
      label,
      address_or_identifier,
      network
    });

    res.json({ ok: true, account });
  });

  app.post("/api/accounts/:id/pause", async (req, res) => {
    await ensureVault(CONFIG.vaultPath);
    const account = await setAccountStatus(CONFIG.vaultPath, req.params.id, "paused");
    res.json({ ok: true, account });
  });

  app.post("/api/accounts/:id/resume", async (req, res) => {
    await ensureVault(CONFIG.vaultPath);
    const account = await setAccountStatus(CONFIG.vaultPath, req.params.id, "active");
    res.json({ ok: true, account });
  });

  app.post("/api/accounts/:id/delete", async (req, res) => {
    await ensureVault(CONFIG.vaultPath);
    const account = await setAccountStatus(CONFIG.vaultPath, req.params.id, "deleted");
    res.json({ ok: true, account });
  });

  app.post("/api/accounts/purge-deleted", async (_req, res) => {
    await ensureVault(CONFIG.vaultPath);
    const result = await purgeDeletedAccounts(CONFIG.vaultPath);
    res.json({ ok: true, ...result });
  });
}
