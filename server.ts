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

  // Digital Asset Links for Trusted Web Activity (Android TWA verification)
  app.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json([
      {
        "relation": [
          "delegate_permission/common.handle_all_urls"
        ],
        "target": {
          "namespace": "android_app",
          "package_name": "app.run.asia_southeast1.kalkulator_fiqh_darah_1090034804909.twa",
          "sha256_cert_fingerprints": [
            "01:B9:09:E9:52:4D:A2:4D:25:C7:C5:7C:4B:85:22:22:6B:30:95:00:FD:FA:1F:97:5D:8B:70:BB:8B:76:19:50"
          ]
        }
      }
    ]);
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
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
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
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
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

    // Custom robust static file server to bypass any express.static quirks
    app.use((req, res, next) => {
      let safePath = decodeURIComponent(req.path);
      // Clean path to prevent directory traversal
      safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, "");
      
      const filePath = path.join(distPath, safePath);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        let mime = "application/octet-stream";
        if (ext === ".png") mime = "image/png";
        else if (ext === ".svg") mime = "image/svg+xml";
        else if (ext === ".ico") mime = "image/x-icon";
        else if (ext === ".js") mime = "application/javascript";
        else if (ext === ".css") mime = "text/css";
        else if (ext === ".json") mime = "application/json";
        else if (ext === ".webmanifest") mime = "application/manifest+json";
        
        res.setHeader("Content-Type", mime);
        
        const fileName = path.basename(filePath);
        if (ext === ".html" || fileName === "sw.js" || ext === ".webmanifest" || ext === ".json") {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        return res.sendFile(filePath);
      }
      next();
    });
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
