import express from "express";
import { createServer } from "http";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { handleOAuthCallback } from "./_core/oauth";
import { ENV } from "./_core/env";
import { registerEmailRoutes } from "./email/emailRoutes";
import { registerAttachmentRoutes } from "./attachments/attachmentRoutes";
import { registerDocumentRoutes } from "./documents/documentRoutes";

// __dirname is natively available in CJS (esbuild --format=cjs injects it)
declare const __dirname: string;

async function startServer() {
  const app = express();
  app.use(express.json());

  // OAuth callback
  app.get("/api/oauth/callback", handleOAuthCallback);

  // Email OAuth routes (Gmail + Outlook)
  registerEmailRoutes(app);

  // Ticket file attachment upload routes
  registerAttachmentRoutes(app as any);

  // Property document upload routes
  registerDocumentRoutes(app as any);

  // Health check for Railway
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Static files - in production, serve the Vite build output
  const staticPath =
    ENV.nodeEnv === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  if (ENV.nodeEnv === "production") {
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  const server = createServer(app);
  server.listen(ENV.port, () => {
    console.log(`Portier369 server running on http://localhost:${ENV.port}/`);
  });
}

startServer().catch(console.error);
