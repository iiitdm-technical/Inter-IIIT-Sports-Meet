// Database snapshots every 6 hours (00:00, 06:00, 12:00, 18:00 server time).
// Installed outside the releases so deploys and rollbacks do not touch it:
//   cp scripts/db-backup.sh ecosystem.backup.config.cjs ~/.local/share/inter-iiit/bin/
//   pm2 start ~/.local/share/inter-iiit/bin/ecosystem.backup.config.cjs && pm2 save
module.exports = {
  apps: [{
    name: "db-backup",
    cwd: __dirname,
    script: "./db-backup.sh",
    interpreter: "bash",
    cron_restart: "0 */6 * * *",
    autorestart: false,
    time: true,
  }],
};
