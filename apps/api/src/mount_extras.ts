// apps/api/src/mount_extras.ts
import type { Express } from "express";

/*
  Extras must never crash the API
  This module mounts extras only if the export is valid middleware
*/

function looksLikeRouter(fn: any) {
  return (
    typeof fn === "function" &&
    typeof fn.use === "function" &&
    Array.isArray(fn.stack)
  );
}

function looksLikeMiddleware(fn: any) {
  return typeof fn === "function";
}

export async function mountExtras(app: Express) {
  try {
    const mod: any = await import("./routes_extras");

    const candidate =
      mod?.registerRoutesExtras ??
      mod?.default ??
      mod?.routesExtras ??
      mod?.router ??
      mod?.extras;

    if (!candidate) {
      console.log("[augur] extras skipped no export");
      return;
    }

    if (looksLikeRouter(candidate)) {
      app.use(candidate);
      console.log("[augur] extras mounted router");
      return;
    }

    if (looksLikeMiddleware(candidate)) {
      // registrar style expects (app) or middleware style expects (req,res,next)
      // call as registrar first, fallback to app.use
      try {
        candidate(app);
        console.log("[augur] extras registered");
        return;
      } catch {
        app.use(candidate);
        console.log("[augur] extras mounted middleware");
        return;
      }
    }

    console.log("[augur] extras skipped invalid export");
  } catch (err) {
    console.log("[augur] extras skipped", err);
  }
}
