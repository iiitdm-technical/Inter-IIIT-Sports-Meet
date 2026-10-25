// DreamHost's existing site proxy forwards to port 8010. Secrets stay in the
// release's protected .env file; Next loads it at startup.
module.exports = {
  apps: [{
    name: "sports",
    cwd: __dirname,
    script: "./node_modules/next/dist/bin/next",
    // DreamHost's managed proxy reaches the VPS interface, not loopback.
    // Preserve the existing binding; changing it causes public HTTP 503s.
    args: "start --hostname 0.0.0.0 --port 8010",
    interpreter: "node",
    env: { NODE_ENV: "production", PORT: "8010" },
    autorestart: true,
    max_memory_restart: "700M",
    time: true,
  }],
};
