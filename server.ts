import express from "express";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware
  app.use(express.json());

  // API Route example
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serving static files in production
    const distPath = path.join(process.cwd(), "dist");

    // Highly-compatible PWA endpoints to ensure instant & correct loading
    app.get("/manifest.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const jsonPath = path.join(distPath, "manifest.json");
      const webmanifestPath = path.join(distPath, "manifest.webmanifest");
      if (fs.existsSync(jsonPath)) {
        res.sendFile(jsonPath);
      } else if (fs.existsSync(webmanifestPath)) {
        res.sendFile(webmanifestPath);
      } else {
        res.status(404).json({ error: "Manifest not found" });
      }
    });

    app.get("/manifest.webmanifest", (req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const jsonPath = path.join(distPath, "manifest.json");
      const webmanifestPath = path.join(distPath, "manifest.webmanifest");
      if (fs.existsSync(webmanifestPath)) {
        res.sendFile(webmanifestPath);
      } else if (fs.existsSync(jsonPath)) {
        res.sendFile(jsonPath);
      } else {
        res.status(404).send("Manifest not found");
      }
    });

    app.get("/favicon.ico", (req, res) => {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.sendFile(path.join(distPath, "icon-192.png"));
    });

    app.use(express.static(distPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        const file = filePath.toLowerCase();
        if (file.endsWith(".html") || file.endsWith("sw.js") || file.endsWith("manifest.webmanifest") || file.endsWith(".json")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
