import express from "express";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json([
      {
        "relation": [
          "delegate_permission/common.handle_all_urls"
        ],
        "target": {
          "namespace": "android_app",
          "package_name": "app.run.asia_southeast1.kalkulator_fiqh_darah_1090034804909.twa",
          "sha256_cert_fingerprints": [
            "D6:CF:3D:F0:CE:60:3C:B8:ED:54:71:88:45:02:D5:AE:05:56:59:94:37:3D:A8:9D:86:DF:26:45:A7:1A:41:0F"
          ]
        }
      }
    ]);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    
    // Serve root index explicitly 
    app.get("/", (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(indexHtml);
    });

    app.use(express.static(distPath));

    // Fallback for SPA routing
    app.get("*", (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(indexHtml);
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
