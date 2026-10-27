import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const updateScript = path.join(projectRoot, "update.sh");
const realNode = process.execPath;
const realCurl = spawnSync("sh", ["-c", "command -v curl"], { encoding: "utf8" }).stdout.trim();

function command(file, args, options = {}) {
  return spawnSync(file, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
}

function git(cwd, ...args) {
  const result = command("git", ["-C", cwd, ...args]);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

const fakeNextSource = `
const http = require("node:http");
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const hostIndex = args.indexOf("--hostname");
const port = Number(args[portIndex + 1]);
const host = args[hostIndex + 1];
http.createServer((request, response) => {
  if (request.url.split("?")[0] === "/api/auth/me") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("test server ready");
}).listen(port, host);
`;

async function getFreeLoopbackPorts(count) {
  const servers = [];
  const ports = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          servers.push(server);
          ports.push(server.address().port);
          resolve();
        });
      });
    }
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
  return ports;
}

async function createFixture({ branch = "main", sharedEnv = true } = {}) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sports-update-test-"));
  const repo = path.join(sandbox, "checkout");
  const remote = path.join(sandbox, "origin.git");
  const home = path.join(sandbox, "home");
  const deployRoot = path.join(home, ".local", "share", "inter-iiit");
  const oldRelease = path.join(deployRoot, "releases", "mysql-active");
  const bin = path.join(sandbox, "bin");
  const state = path.join(sandbox, "pm2-state");
  const npmLog = path.join(sandbox, "npm.log");
  const pm2Log = path.join(sandbox, "pm2.log");
  const appSource = path.join(sandbox, "fake-next.cjs");
  const [candidatePort, activePort] = await getFreeLoopbackPorts(2);
  assert.notEqual(candidatePort, 8010);
  assert.notEqual(candidatePort, 18010);
  assert.notEqual(activePort, 8010);
  assert.notEqual(activePort, 18010);

  await Promise.all([
    mkdir(repo, { recursive: true }),
    mkdir(home, { recursive: true }),
    mkdir(bin, { recursive: true }),
    mkdir(state, { recursive: true }),
  ]);
  await writeFile(appSource, fakeNextSource);
  command("git", ["init", "--bare", "--initial-branch=main", remote]);
  command("git", ["init", `--initial-branch=${branch}`, repo]);
  git(repo, "config", "user.email", "update-test@example.invalid");
  git(repo, "config", "user.name", "Update Test");
  await writeFile(path.join(repo, ".gitignore"), ".env*\n/node_modules/\n");
  await writeFile(path.join(repo, "package.json"), '{"name":"update-fixture","version":"1.0.0"}\n');
  await writeFile(path.join(repo, "ecosystem.config.cjs"), `module.exports = { apps: [{ name: "sports", cwd: __dirname, script: "./node_modules/next/dist/bin/next", args: "start --hostname 0.0.0.0 --port 8010", interpreter: "node" }] };\n`);
  await copyFile(updateScript, path.join(repo, "update.sh"));
  await chmod(path.join(repo, "update.sh"), 0o755);
  await writeFile(path.join(repo, ".env"), "DATABASE_URL=mysql://source-secret.invalid/old\n");
  await mkdir(path.join(repo, "node_modules"), { recursive: true });
  await writeFile(path.join(repo, "node_modules", "source-only-marker"), "must not enter release");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "initial deployment source");
  git(repo, "remote", "add", "origin", remote);
  if (branch === "main") {
    git(repo, "push", "--set-upstream", "origin", "main");
  }

  await mkdir(path.join(deployRoot, "shared"), { recursive: true });
  await mkdir(oldRelease, { recursive: true });
  await writeFile(path.join(oldRelease, "ecosystem.config.cjs"), `module.exports = { apps: [{ name: "sports", cwd: __dirname, script: "./node_modules/next/dist/bin/next", args: "start --hostname 0.0.0.0 --port 8010", interpreter: "node" }] };\n`);
  await mkdir(path.join(oldRelease, "node_modules", "next", "dist", "bin"), { recursive: true });
  await copyFile(appSource, path.join(oldRelease, "node_modules", "next", "dist", "bin", "next"));
  await symlink(oldRelease, path.join(deployRoot, "current"));
  if (sharedEnv) {
    await writeFile(path.join(deployRoot, "shared", ".env"), "DATABASE_URL=mysql://shared-secret.invalid/live\nSESSION_SECRET=shared-test-secret\n");
    await chmod(path.join(deployRoot, "shared", ".env"), 0o600);
  }

  const executable = async (name, contents) => {
    const target = path.join(bin, name);
    await writeFile(target, `#!/usr/bin/env bash\nset -Eeuo pipefail\n${contents}\n`);
    await chmod(target, 0o755);
  };
  await executable("node", `if [[ "\${1:-}" == "--version" ]]; then echo v22.23.4; exit 0; fi\nexec "$REAL_NODE" "$@"`);
  await executable("npm", `
printf '%s\\n' "$*" >> "$NPM_LOG"
if [[ "\${1:-}" == "--prefix" ]]; then prefix=$2; shift 2; else prefix=$PWD; fi
if [[ "\${1:-}" == ci ]]; then
  mkdir -p "$prefix/node_modules/next/dist/bin"
  cp "$FAKE_APP_SOURCE" "$prefix/node_modules/next/dist/bin/next"
fi
if [[ " \$* " == *" run build -- --webpack "* && \${FAIL_NPM_STEP:-} == build ]]; then exit 41; fi
if [[ " \$* " == *" run db:migrate "* && \${FAIL_NPM_STEP:-} == migrate ]]; then exit 42; fi
exit 0`);
  await executable("pm2", `
printf '%s\\n' "$*" >> "$PM2_LOG"
case "\${1:-}" in
  delete)
    if [[ -f "$PM2_PID_FILE" ]]; then kill "$(cat "$PM2_PID_FILE")" 2>/dev/null || true; rm -f "$PM2_PID_FILE"; fi
    rm -f "$PM2_STATE_FILE"
    ;;
  start)
    config=$2
    app=$("$REAL_NODE" -e 'const path=require("node:path"); const file=process.argv[1]; const item=require(file).apps[0]; const cwd=path.resolve(item.cwd || path.dirname(file)); process.stdout.write(JSON.stringify({name:item.name,cwd,script:path.resolve(cwd,item.script),status:"online"}));' "$config")
    printf '%s' "$app" > "$PM2_STATE_FILE"
    script=$("$REAL_NODE" -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).script)' "$PM2_STATE_FILE")
    "$REAL_NODE" "$script" start --hostname 127.0.0.1 --port "$FAKE_ACTIVE_PORT" > "$PM2_SERVER_LOG" 2>&1 &
    echo $! > "$PM2_PID_FILE"
    ;;
  jlist)
    if [[ -f "$PM2_STATE_FILE" ]]; then
      "$REAL_NODE" -e 'const x=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(JSON.stringify([{name:x.name,pm_exec_path:x.script,pm2_env:{status:x.status,pm_cwd:x.cwd}}]));' "$PM2_STATE_FILE"
    else echo '[]'; fi
    ;;
  save) ;;
  *) echo "unexpected PM2 action" >&2; exit 2 ;;
esac`);
  await executable("curl", `args=("$@")
last=$#
url=\${args[$((last - 1))]}
if [[ \${FAIL_ACTIVE_PROBE:-0} == 1 && "$url" == *127.0.0.1:8010* ]]; then exit 7; fi
if [[ "$url" == http://127.0.0.1:8010* ]]; then args[$((last - 1))]="http://127.0.0.1:$FAKE_ACTIVE_PORT\${url#http://127.0.0.1:8010}"; fi
exec "$REAL_CURL" "\${args[@]}"`);

  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    HOME: home,
    REAL_NODE: realNode,
    REAL_CURL: realCurl,
    FAKE_ACTIVE_PORT: String(activePort),
    FAKE_APP_SOURCE: appSource,
    NPM_LOG: npmLog,
    PM2_LOG: pm2Log,
    PM2_STATE_FILE: path.join(state, "process.json"),
    PM2_PID_FILE: path.join(state, "process.pid"),
    PM2_SERVER_LOG: path.join(state, "server.log"),
    UPDATE_PUBLIC_URL: "",
    UPDATE_CANDIDATE_PORT: String(candidatePort),
    UPDATE_PROBE_ATTEMPTS: "100",
    UPDATE_PROBE_INTERVAL: "0",
  };

  return { sandbox, repo, deployRoot, oldRelease, npmLog, pm2Log, state, env };
}

async function cleanup(fixture) {
  try {
    const pidFile = path.join(fixture.state, "process.pid");
    const pid = Number(await readFile(pidFile, "utf8").catch(() => ""));
    if (pid > 0) process.kill(pid, "SIGTERM");
  } catch {}
  await rm(fixture.sandbox, { recursive: true, force: true });
}

function deploy(fixture, args = [], envOverrides = {}) {
  return command("bash", [path.join(fixture.repo, "update.sh"), ...args], {
    cwd: fixture.repo,
    env: { ...fixture.env, ...envOverrides },
  });
}

test("--help is safe and explains explicit migrations", async () => {
  const fixture = await createFixture({ sharedEnv: false });
  try {
    const result = deploy(fixture, ["--help"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: \.\/update\.sh \[--migrate\]/);
    assert.match(result.stdout, /Migrations are never run by default/);
    assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
    assert.deepEqual(await readdir(path.join(fixture.deployRoot, "releases")), ["mysql-active"]);
  } finally {
    await cleanup(fixture);
  }
});

test("deployment requires shared/.env and refuses dirty or non-main checkouts before PM2", async (t) => {
  await t.test("missing shared env", async () => {
    const fixture = await createFixture({ sharedEnv: false });
    try {
      const result = deploy(fixture);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /required regular file is missing or unreadable/);
      assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
    } finally {
      await cleanup(fixture);
    }
  });

  await t.test("dirty checkout", async () => {
    const fixture = await createFixture();
    try {
      await writeFile(path.join(fixture.repo, "untracked-change.txt"), "not safe to deploy");
      const result = deploy(fixture);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Git checkout must be clean, including untracked files/);
      assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
    } finally {
      await cleanup(fixture);
    }
  });

  await t.test("clean main with an unpublished local commit", async () => {
    const fixture = await createFixture();
    try {
      await writeFile(path.join(fixture.repo, "local-only.txt"), "not on origin/main");
      git(fixture.repo, "add", "local-only.txt");
      git(fixture.repo, "commit", "-m", "unpublished change");
      const result = deploy(fixture);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /commits not present on origin\/main/);
      assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
      assert.equal(await readFile(fixture.npmLog, "utf8").catch(() => ""), "");
    } finally {
      await cleanup(fixture);
    }
  });

  await t.test("non-main branch", async () => {
    const fixture = await createFixture({ branch: "feature" });
    try {
      const result = deploy(fixture);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /deployments must run from the main branch/);
      assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
    } finally {
      await cleanup(fixture);
    }
  });
});

test("successful deploy stages a clean release and runs migrations only when requested", async () => {
  const fixture = await createFixture();
  try {
    const result = deploy(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /==> git pull --ff-only origin main/);
    assert.match(result.stdout, /PASS candidate/);
    assert.match(result.stdout, /PASS local port 8010/);
    const npmCalls = await readFile(fixture.npmLog, "utf8");
    assert.match(npmCalls, /ci --include=dev/);
    assert.match(npmCalls, /run lint/);
    assert.match(npmCalls, /test/);
    assert.match(npmCalls, /run build -- --webpack/);
    assert.match(npmCalls, /run env:check/);
    assert.doesNotMatch(npmCalls, /db:migrate/);

    const activeRelease = await realpath(path.join(fixture.deployRoot, "current"));
    assert.match(activeRelease, /\/releases\//);
    assert.equal(await readFile(path.join(activeRelease, ".env"), "utf8"), await readFile(path.join(fixture.deployRoot, "shared", ".env"), "utf8"));
    assert.equal((await stat(path.join(activeRelease, ".env"))).mode & 0o777, 0o600);
    assert.match(await readFile(path.join(activeRelease, "deploy.log"), "utf8"), /run build -- --webpack/);
    assert.equal(await readFile(path.join(activeRelease, "node_modules", "source-only-marker"), "utf8").catch(() => ""), "");
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /shared-secret\.invalid|shared-test-secret|source-secret\.invalid/);

    const pm2Calls = await readFile(fixture.pm2Log, "utf8");
    assert.match(pm2Calls, /delete sports/);
    assert.match(pm2Calls, new RegExp(`start ${activeRelease.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ecosystem\\.config\\.cjs --only sports`));
    assert.match(pm2Calls, /save/);
  } finally {
    await cleanup(fixture);
  }
});

test("build failure leaves the existing PM2 release untouched and skips migrations", async () => {
  const fixture = await createFixture();
  try {
    const result = deploy(fixture, [], { FAIL_NPM_STEP: "build" });
    assert.notEqual(result.status, 0);
    assert.match(await readFile(fixture.npmLog, "utf8"), /run build -- --webpack/);
    assert.doesNotMatch(await readFile(fixture.npmLog, "utf8"), /db:migrate/);
    assert.equal(await readFile(fixture.pm2Log, "utf8").catch(() => ""), "");
    assert.equal(await realpath(path.join(fixture.deployRoot, "current")), fixture.oldRelease);
    const failedReleases = (await readdir(path.join(fixture.deployRoot, "releases"))).filter((name) => name !== "mysql-active");
    assert.equal(failedReleases.length, 1, "failed release should remain for recovery");
    assert.match(await readFile(path.join(fixture.deployRoot, "releases", failedReleases[0], "deploy.log"), "utf8"), /run build -- --webpack/);
  } finally {
    await cleanup(fixture);
  }
});

test("--migrate is the only path that invokes db:migrate", async () => {
  const fixture = await createFixture();
  try {
    const result = deploy(fixture, ["--migrate"]);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(await readFile(fixture.npmLog, "utf8"), /run db:migrate/);
    assert.match(result.stderr, /database DDL that this code rollback cannot undo/);
  } finally {
    await cleanup(fixture);
  }
});

test("failed active health check restores PM2 and keeps current on the old release", async () => {
  const fixture = await createFixture();
  try {
    const result = deploy(fixture, [], { FAIL_ACTIVE_PROBE: "1", UPDATE_PROBE_ATTEMPTS: "100" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restoring the previous PM2 release/);
    assert.equal(await realpath(path.join(fixture.deployRoot, "current")), fixture.oldRelease);
    const pm2Calls = await readFile(fixture.pm2Log, "utf8");
    assert.match(pm2Calls, new RegExp(`start ${fixture.oldRelease.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ecosystem\\.config\\.cjs --only sports`));
    assert.ok(pm2Calls.split("\n").filter((line) => line === "start" || line.startsWith("start ")).length >= 2);
  } finally {
    await cleanup(fixture);
  }
});

test("successful deploy slims the release and keeps only the active and previous releases", async () => {
  const fixture = await createFixture();
  try {
    const releases = path.join(fixture.deployRoot, "releases");
    for (const name of ["20260101T000000Z-older1", "20260102T000000Z-older2"]) {
      await mkdir(path.join(releases, name, "node_modules"), { recursive: true });
      await writeFile(path.join(releases, name, "ecosystem.config.cjs"), "module.exports = {};\n");
    }
    const outside = path.join(fixture.sandbox, "outside-release");
    await mkdir(outside, { recursive: true });
    await symlink(outside, path.join(releases, "link-to-outside"));

    const result = deploy(fixture);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const activeRelease = await realpath(path.join(fixture.deployRoot, "current"));
    const remaining = (await readdir(releases)).sort();
    assert.deepEqual(remaining, ["link-to-outside", "mysql-active", path.basename(activeRelease)].sort());
    assert.equal((await stat(outside)).isDirectory(), true, "symlinked folders outside releases are never followed");
    assert.match(result.stdout, /Removed 2 older release\(s\)/);

    const npmCalls = await readFile(fixture.npmLog, "utf8");
    assert.match(npmCalls, /prune --omit=dev/);
    assert.match(npmCalls, /cache clean --force/);
    assert.match(npmCalls, /run storage:check/);
    const order = ["run env:check", "prune --omit=dev", "cache clean --force", "run storage:check"].map((call) => npmCalls.indexOf(call));
    assert.deepEqual([...order].sort((a, b) => a - b), order, "prune before the candidate starts; cleanup and report after success");
  } finally {
    await cleanup(fixture);
  }
});

test("a failed deployment removes no releases", async () => {
  const fixture = await createFixture();
  try {
    const older = path.join(fixture.deployRoot, "releases", "20260101T000000Z-older1");
    await mkdir(older, { recursive: true });
    const result = deploy(fixture, [], { FAIL_NPM_STEP: "build" });
    assert.notEqual(result.status, 0);
    assert.equal((await stat(older)).isDirectory(), true);
    assert.doesNotMatch(await readFile(fixture.npmLog, "utf8"), /cache clean|storage:check|prune/);
  } finally {
    await cleanup(fixture);
  }
});
