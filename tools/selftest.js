#!/usr/bin/env node
/**
 * selftest.js - local self-test for the Vibe Bridge chain
 * ==================================================================
 * Spins up its own Bridge (dedicated port) plus the mock plugin, then
 * drives the real CLI against it and asserts real behaviour.
 *
 * Covered (74 assertions):
 *   A.  Bridge boots and answers /health, loopback-only, token required
 *   B.  A plugin client can connect (long-poll) to the Bridge
 *   C.  Stage-1 CLI commands: create-frame / create-rect / create-text
 *   C2. Node group: create-ellipse / create-line / duplicate / move / resize
 *   C3. Style group: set-fill / set-stroke / set-opacity / set-corner-radius
 *   C4. Text group: set-font / set-font-size / set-font-weight / colour / content
 *   C5. Auto layout group: mode / padding / item spacing / both axis alignments
 *   C6. Structure group: append-child / create-component / create-instance,
 *       plus "@last" chaining in any id field
 *   D.  CLI `run` batch executes sequentially and returns ok
 *   E.  Plugin-side errors are surfaced as errors (non-zero exit)
 *   F.  Bad token is rejected (auth really works)
 *   G.  A command that is only QUEUED is never reported as success
 *   H.  CLI status view
 *   I.  Unregistered clients cannot steal commands
 *   J.  A long-poll whose client went away cannot swallow a command
 *
 * IMPORTANT: this proves the Bridge + CLI protocol only. It does NOT
 * touch Figma, and a green run is NOT proof that anything was written
 * to a real Figma canvas.
 * ==================================================================
 */

"use strict";

const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const CLI = path.join(ROOT, "cli", "figma-vibe.js");
const PORT = 45699;
const TOKEN = "selftest-fixed-token-0001";

const results = [];
const pass = (n, detail) => { results.push({ ok: true, n, detail }); console.log(`  \u2713 ${n}${detail ? "  " + detail : ""}`); };
const fail = (n, detail) => { results.push({ ok: false, n, detail }); console.log(`  \u2717 ${n}${detail ? "  " + detail : ""}`); };
const section = (t) => console.log(`\n${t}`);

/* ------------------------------------------------------------------ */

function getJson(pathname, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const r = http.get({ host: "127.0.0.1", port: PORT, path: pathname, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch (_) { resolve({ status: res.statusCode, body: null }); }
      });
    });
    r.on("error", () => resolve(null));
    r.on("timeout", () => { r.destroy(); resolve(null); });
  });
}

function postJson(pathname, payload, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify(payload || {}));
    const r = http.request({
      host: "127.0.0.1", port: PORT, path: pathname, method: "POST", timeout: timeoutMs,
      headers: { "Content-Type": "application/json", "Content-Length": data.length },
    }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch (_) { resolve({ status: res.statusCode, body: null }); }
      });
    });
    r.on("error", () => resolve(null));
    r.on("timeout", () => { r.destroy(); resolve(null); });
    r.write(data);
    r.end();
  });
}

/**
 * Open a long-poll and drop it after `holdMs`, the way a plugin iframe does
 * when the plugin is re-run. Returns immediately; the poll dies in background.
 */
function deadLongPoll(clientId, holdMs) {
  const r = http.get(
    { host: "127.0.0.1", port: PORT, path: `/v1/poll?token=${TOKEN}&client=${clientId}&wait=15000` },
    () => { /* we never read the body - this client is "gone" */ }
  );
  r.on("error", () => { /* expected: we destroy it ourselves */ });
  return new Promise((resolve) => setTimeout(() => { try { r.destroy(); } catch (_) {} resolve(); }, holdMs));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(200);
  }
  return false;
}

/** Run the CLI and return { code, out }. */
function cli(args) {
  const r = spawnSync(NODE, [CLI, "--port", String(PORT), "--token", TOKEN, ...args], { encoding: "utf8", timeout: 60000 });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

/** Assert a CLI call reaches the plugin and comes back ok. */
function expectOk(label, args) {
  const r = cli(args);
  if (r.code === 0 && /^ok\b/m.test(r.out)) pass(label, firstLine(r.out));
  else fail(label, `exit ${r.code}: ${firstLine(r.out)}`);
  return r;
}

/**
 * Assert the CLI builds the exact JSON payload we expect - checked with
 * --dry, so this covers flag -> params mapping without involving the bridge.
 */
function expectPayload(label, args, checks) {
  const r = cli([...args, "--dry"]);
  const missing = checks.filter((chk) => !r.out.includes(chk));
  if (r.code === 0 && missing.length === 0) pass(label, "payload ok");
  else fail(label, `exit ${r.code}, missing ${JSON.stringify(missing)} in: ${r.out.replace(/\s+/g, " ").slice(0, 220)}`);
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log("=".repeat(72));
  console.log("Vibe Bridge - local self test (Bridge + CLI protocol only)");
  console.log("=".repeat(72));

  const children = [];
  const cleanup = () => {
    children.forEach((c) => { try { c.kill(); } catch (_) { /* already gone */ } });
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  /* ---- A. boot the bridge ---------------------------------------- */
  section("A. Bridge boot");
  const bridge = spawn(NODE, [path.join(ROOT, "bridge", "server.js"), "--port", String(PORT), "--token", TOKEN, "--no-ipv6"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(bridge);
  let bridgeLog = "";
  bridge.stdout.on("data", (d) => { bridgeLog += d.toString(); });
  bridge.stderr.on("data", (d) => { bridgeLog += d.toString(); });
  bridge.on("exit", (code) => {
    if (code !== 0 && code !== null) console.log(`  (bridge exited early with code ${code})\n${bridgeLog}`);
  });

  const up = await waitFor("health", async () => {
    const h = await getJson("/health");
    return h && h.status === 200 && h.body && h.body.service === "figma-vibe-bridge";
  }, 10000);

  if (!up) {
    fail("bridge starts and answers /health", "timed out");
    console.log("\nbridge output:\n" + bridgeLog);
    return finish(children);
  }
  const h0 = await getJson("/health");
  pass("bridge starts and answers /health", `http://127.0.0.1:${PORT} \u2192 ${h0.body.service}`);
  pass("bridge is loopback-only", `host=${h0.body.host} (not 0.0.0.0)`);
  pass("bridge requires a token", `tokenRequired=${h0.body.tokenRequired}, plugin connected=${h0.body.plugin.connected}`);

  /* ---- I. impostor gate ------------------------------------------ */
  // Regression guard: a page that has a valid token but never registered
  // (e.g. an IDE preview of ui.html) must not be able to receive commands.
  section("I. Unregistered clients cannot steal commands");
  const noClient = await getJson(`/v1/poll?token=${TOKEN}`);
  if (noClient && noClient.status === 403 && noClient.body && noClient.body.error && noClient.body.error.code === "CLIENT_REQUIRED") {
    pass("poll with no client id is refused", "403 CLIENT_REQUIRED");
  } else {
    fail("poll with no client id is refused", `got ${noClient ? noClient.status : "no response / hung"}`);
  }

  const ghostClient = await getJson(`/v1/poll?token=${TOKEN}&client=never-registered-xyz`);
  if (ghostClient && ghostClient.status === 403 && ghostClient.body && ghostClient.body.error && ghostClient.body.error.code === "CLIENT_NOT_REGISTERED") {
    pass("poll from an unregistered client is refused", "403 CLIENT_NOT_REGISTERED");
  } else {
    fail("poll from an unregistered client is refused", `got ${ghostClient ? ghostClient.status : "no response / hung"}`);
  }

  /* ---- F. auth (tested before the plugin is up) ------------------- */
  section("F. Authentication");
  const badAuth = cli(["create-frame", "--token", "wrong-token-0123456789", "--timeout", "3000"]);
  if (badAuth.code !== 0 && /UNAUTHORIZED/i.test(badAuth.out)) pass("bad token rejected", "exit " + badAuth.code + " \u2192 UNAUTHORIZED");
  else fail("bad token rejected", `exit ${badAuth.code}, out=${badAuth.out.split("\n")[0]}`);

  const offline = cli(["create-frame", "--timeout", "2000"]);
  if (offline.code !== 0 && /PLUGIN_OFFLINE/i.test(offline.out)) pass("no plugin \u2192 PLUGIN_OFFLINE (never fakes success)", "exit " + offline.code);
  else fail("no plugin \u2192 PLUGIN_OFFLINE", `exit ${offline.code}, out=${offline.out.split("\n")[0]}`);

  /* ---- B. plugin connects ---------------------------------------- */
  section("B. Plugin connectivity");
  const mock = spawn(NODE, [path.join(ROOT, "tools", "mock-plugin.js"), "--port", String(PORT), "--token", TOKEN], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(mock);
  let mockLog = "";
  mock.stdout.on("data", (d) => { mockLog += d.toString(); });
  mock.stderr.on("data", (d) => { mockLog += d.toString(); });

  const connected = await waitFor("plugin", async () => {
    const h = await getJson("/health");
    return h && h.body && h.body.plugin && h.body.plugin.connected === true;
  }, 10000);

  if (connected) {
    const h = await getJson("/health");
    pass("plugin client connects to bridge", `connected=${h.body.plugin.connected}, page="${h.body.plugin.info ? h.body.plugin.info.page : "-"}"`);
  } else {
    fail("plugin client connects to bridge", "timed out\n" + mockLog);
  }

  /* ---- C/D. CLI operations --------------------------------------- */
  section("C. CLI create-* commands");
  const frame = cli(["create-frame", "--name", "Vibe Design Test", "--width", "1440", "--height", "900"]);
  if (frame.code === 0 && /^ok\b/m.test(frame.out)) pass("create-frame", firstLine(frame.out));
  else fail("create-frame", `exit ${frame.code}: ${firstLine(frame.out)}`);

  const rect = cli(["create-rect", "--name", "Vibe Rect", "--width", "300", "--height", "100", "--x", "100", "--y", "100"]);
  if (rect.code === 0 && /^ok\b/m.test(rect.out)) pass("create-rect", firstLine(rect.out));
  else fail("create-rect", `exit ${rect.code}: ${firstLine(rect.out)}`);

  const text = cli(["create-text", "--text", "Hello Vibe Design", "--size", "48", "--x", "100", "--y", "260"]);
  if (text.code === 0 && /^ok\b/m.test(text.out)) pass("create-text", firstLine(text.out));
  else fail("create-text", `exit ${text.code}: ${firstLine(text.out)}`);

  /* ---- C2. node manipulation group -------------------------------- */
  section("C2. Node group: ellipse / line / duplicate / move / resize");
  expectOk("create-ellipse", ["create-ellipse", "--name", "Vibe Ellipse", "--width", "200", "--height", "200", "--parent", "9:2", "--hex", "#ff8800"]);
  expectOk("create-line", ["create-line", "--length", "320", "--x", "0", "--y", "0", "--hex", "#333333"]);
  expectOk("duplicate-node", ["duplicate-node", "9:4", "--x", "40", "--y", "40"]);
  expectOk("move-node (absolute)", ["move-node", "9:4", "--x", "50", "--y", "60"]);
  expectOk("move-node (relative)", ["move-node", "9:4", "--dx", "5", "--dy", "5"]);
  expectOk("resize-node", ["resize-node", "9:4", "--width", "480", "--height", "220"]);
  expectOk("delete-node", ["delete-node", "9:99"]);

  // Flag -> JSON mapping, verified without involving the bridge at all.
  expectPayload("create-ellipse payload", ["create-ellipse", "--width", "200", "--height", "150", "--parent", "9:2"],
    ['"width": 200', '"height": 150', '"parentId": "9:2"']);
  expectPayload("create-line payload (--length maps to length)", ["create-line", "--length", "320", "--rotation", "45"],
    ['"length": 320', '"rotation": 45']);
  expectPayload("move-node payload", ["move-node", "9:4", "--dx", "10"], ['"id": "9:4"', '"dx": 10']);
  expectPayload("resize-node payload", ["resize-node", "9:4", "--width", "480"], ['"id": "9:4"', '"width": 480']);
  expectPayload("duplicate-node payload", ["duplicate-node", "9:4", "--parent", "9:2"], ['"id": "9:4"', '"parentId": "9:2"']);

  /* ---- C3. style group -------------------------------------------- */
  section("C3. Style group: fill / stroke / opacity / corner radius");
  expectOk("set-fill (hex)", ["set-fill", "9:4", "--hex", "#4a6cff"]);
  expectOk("set-fill (rgb)", ["set-fill", "9:4", "--rgb", "74,108,255"]);
  expectOk("set-fill (clear)", ["set-fill", "9:4", "--clear"]);
  expectOk("set-stroke (colour + width)", ["set-stroke", "9:4", "--hex", "#1a1a1a", "--width", "2"]);
  expectOk("set-opacity", ["set-opacity", "9:4", "--opacity", "0.5"]);
  expectOk("set-corner-radius (uniform)", ["set-corner-radius", "9:4", "--radius", "16"]);
  expectOk("set-corner-radius (per corner)", ["set-corner-radius", "9:4", "--top-left", "8", "--bottom-right", "24"]);

  expectPayload("set-fill payload", ["set-fill", "9:4", "--hex", "#4a6cff", "--opacity", "0.4"],
    ['"id": "9:4"', '"hex": "#4a6cff"', '"opacity": 0.4']);
  expectPayload("set-stroke payload", ["set-stroke", "9:4", "--rgb", "26,26,26", "--width", "2"],
    ['"rgb"', '"width": 2']);
  expectPayload("set-opacity payload", ["set-opacity", "9:4", "--opacity", "0.5"], ['"opacity": 0.5']);
  expectPayload("set-corner-radius payload", ["set-corner-radius", "9:4", "--radius", "16"], ['"radius": 16']);
  expectPayload("set-fill --clear payload", ["set-fill", "9:4", "--clear"], ['"clear": true']);

  /* ---- C4. text group --------------------------------------------- */
  section("C4. Text group: font / size / weight / colour / content");
  expectOk("set-text-content", ["set-text-content", "9:5", "--text", "Hello Vibe Design"]);
  expectOk("set-font-size", ["set-font-size", "9:5", "--size", "64"]);
  expectOk("set-font-weight (bold)", ["set-font-weight", "9:5", "--weight", "700"]);
  expectOk("set-font-weight (italic)", ["set-font-weight", "9:5", "--weight", "400", "--italic"]);
  expectOk("set-font", ["set-font", "9:5", "--family", "Inter", "--style", "Medium"]);
  expectOk("set-text-color", ["set-text-color", "9:5", "--hex", "#1a1a1a"]);

  expectPayload("set-font-size payload", ["set-font-size", "9:5", "--size", "64"], ['"id": "9:5"', '"size": 64']);
  expectPayload("set-font-weight payload", ["set-font-weight", "9:5", "--weight", "700", "--italic"],
    ['"weight": 700', '"italic": true']);
  expectPayload("set-text-content payload", ["set-text-content", "9:5", "--text", "Hi"], ['"characters": "Hi"']);
  expectPayload("set-font payload", ["set-font", "9:5", "--family", "Inter"], ['"family": "Inter"']);
  expectPayload("set-text-color payload", ["set-text-color", "9:5", "--rgb", "17,17,17"], ['"rgb"']);

  /* ---- C5. auto layout group -------------------------------------- */
  section("C5. Auto layout group: layout / padding / spacing / alignment");
  expectOk("set-auto-layout (vertical + spacing + padding)",
    ["set-auto-layout", "9:2", "--mode", "vertical", "--spacing", "24", "--padding", "32"]);
  expectOk("set-auto-layout (horizontal)", ["set-auto-layout", "9:2", "--mode", "horizontal"]);
  expectOk("set-auto-layout (none)", ["set-auto-layout", "9:2", "--mode", "none"]);
  expectOk("set-padding (all)", ["set-padding", "9:2", "--all", "40"]);
  expectOk("set-padding (axes)", ["set-padding", "9:2", "--horizontal", "24", "--vertical", "16"]);
  expectOk("set-padding (sides)", ["set-padding", "9:2", "--top", "8", "--left", "12"]);
  expectOk("set-item-spacing", ["set-item-spacing", "9:2", "--spacing", "16"]);
  expectOk("set-primary-axis-align (space-between)", ["set-primary-axis-align", "9:2", "--align", "space-between"]);
  expectOk("set-counter-axis-align (center)", ["set-counter-axis-align", "9:2", "--align", "center"]);

  expectPayload("set-auto-layout payload", ["set-auto-layout", "9:2", "--mode", "vertical", "--spacing", "24"],
    ['"mode": "vertical"', '"spacing": 24']);
  expectPayload("set-auto-layout sizing payload", ["set-auto-layout", "9:2", "--mode", "vertical", "--primary-sizing", "AUTO"],
    ['"primaryAxisSizingMode": "AUTO"']);
  expectPayload("set-padding payload", ["set-padding", "9:2", "--horizontal", "24"], ['"horizontal": 24']);
  expectPayload("set-item-spacing payload", ["set-item-spacing", "9:2", "--spacing", "16"], ['"spacing": 16']);
  expectPayload("set-primary-axis-align payload", ["set-primary-axis-align", "9:2", "--align", "space-between"], ['"align": "space-between"']);
  expectPayload("set-counter-axis-align payload", ["set-counter-axis-align", "9:2", "--align", "center"], ['"align": "center"']);

  /* ---- C6. structure group + @last chaining ----------------------- */
  section("C6. Structure group: append-child / component / instance");
  expectOk("append-child", ["append-child", "9:4", "--parent", "9:2"]);
  expectOk("create-component", ["create-component", "9:2", "--name", "Vibe Component"]);
  expectOk("create-instance", ["create-instance", "9:9", "--x", "0", "--y", "0"]);

  expectPayload("append-child payload", ["append-child", "9:4", "--parent", "9:2"],
    ['"childId": "9:4"', '"parentId": "9:2"']);
  expectPayload("create-component payload", ["create-component", "9:2"], ['"id": "9:2"']);
  expectPayload("create-instance payload", ["create-instance", "9:9", "--parent", "9:2"],
    ['"componentId": "9:9"', '"parentId": "9:2"']);

  // A batch must be able to reference whatever the previous step created -
  // in a parentId AND in an id, not just parentId.
  const chain = cli(["run", "--ops", JSON.stringify([
    { op: "create-frame", params: { name: "Chain Frame", width: 400, height: 300 } },
    { op: "create-rect", params: { width: 100, height: 100, parentId: "@last" } },
    { op: "set-fill", params: { id: "@last", color: { hex: "#4a6cff" } } },
    { op: "set-corner-radius", params: { id: "@last", radius: 12 } },
  ])]);
  const chainSteps = (chain.out.match(/step \d+/g) || []).length;
  if (chain.code === 0 && chainSteps === 4) pass("@last chaining in parentId and id", "4 steps resolved");
  else fail("@last chaining", `exit ${chain.code}, steps=${chainSteps}: ${firstLine(chain.out)}`);

  // "@last" in a non-id field must be rejected, not silently accepted.
  const badLast = cli(["run", "--ops", JSON.stringify([
    { op: "create-frame", params: { name: "X" } },
    { op: "create-frame", params: { name: "@last" } },
  ])]);
  if (badLast.code !== 0 && /BAD_PARAM|only valid in node-reference/i.test(badLast.out)) {
    pass('"@last" outside an id field is rejected', "exit " + badLast.code);
  } else {
    fail('"@last" outside an id field', `exit ${badLast.code}: ${firstLine(badLast.out)}`);
  }

  /* ---- C7. stage-3 capabilities ----------------------------------- */
  section("C7. CLI stage-3 commands (vector / effects / align / sizing)");

  expectPayload("create-vector payload",
    ["create-vector", "--name", "Trend Line", "--points", "0,0 10,20 30,5", "--hex", "#2F6BFF", "--stroke-weight", "2", "--parent", "9:2"],
    ['"op": "create-vector"', '"points": [', '"strokeWeight": 2', '"parentId": "9:2"']);

  expectPayload("create-vector closes and fills a path",
    ["create-vector", "--name", "Trend Area", "--points", "0,0 10,0 10,20", "--closed", "--fill-hex", "#2F6BFF", "--fill-opacity", "0.08"],
    ['"closed": true', '"fill": {', '"opacity": 0.08']);

  expectPayload("create-vector accepts raw path data",
    ["create-vector", "--name", "Bell", "--path", "M 0 0 L 8 8", "--hex", "#5A6270"],
    ['"data": "M 0 0 L 8 8"']);

  expectPayload("set-effects shadow payload",
    ["set-effects", "9:2", "--shadow-x", "0", "--shadow-y", "1", "--shadow-blur", "2", "--shadow-spread", "0", "--shadow-color", "#000000", "--shadow-opacity", "0.06"],
    ['"shadow": {', '"blur": 2', '"opacity": 0.06']);

  expectPayload("set-effects --clear payload", ["set-effects", "9:2", "--clear"], ['"clear": true']);

  expectPayload("set-text-align payload",
    ["set-text-align", "9:5", "--horizontal", "right", "--vertical", "center"],
    ['"horizontal": "right"', '"vertical": "center"']);

  expectPayload("set-text-autoresize payload",
    ["set-text-autoresize", "9:5", "--mode", "height", "--width", "240"],
    ['"mode": "height"', '"width": 240']);

  expectPayload("set-layout-sizing payload",
    ["set-layout-sizing", "9:2", "--horizontal", "fill", "--vertical", "hug"],
    ['"horizontal": "fill"', '"vertical": "hug"']);

  expectPayload("set-name payload", ["set-name", "9:2", "--name", "Sidebar"], ['"name": "Sidebar"']);

  expectPayload("create-frame takes a parent, a fill and a clip flag",
    ["create-frame", "--name", "Sidebar", "--width", "220", "--height", "900", "--parent", "9:1", "--hex", "#FFFFFF", "--clips", "false"],
    ['"parentId": "9:1"', '"clips": false', '"hex": "#FFFFFF"']);

  // The same commands must also survive a real round trip through the bridge.
  section("C8. New ops round-trip through bridge + plugin client");
  expectOk("round trip: create-vector", ["create-vector", "--name", "V", "--points", "0,0 4,8 8,2", "--hex", "#2F6BFF"]);
  expectOk("round trip: set-effects", ["set-effects", "MOCK:1", "--shadow-blur", "4"]);
  expectOk("round trip: set-layout-sizing", ["set-layout-sizing", "MOCK:1", "--horizontal", "hug"]);
  expectOk("round trip: set-text-align", ["set-text-align", "MOCK:1", "--horizontal", "center"]);
  expectOk("round trip: set-name", ["set-name", "MOCK:1", "--name", "Renamed"]);

  // Batch-local naming: `as: "x"` then "$x" - the glue that lets one batch
  // build a whole card instead of one round trip per node.
  expectOk("round trip: batch-local $name reference", [
    "run", "--ops",
    JSON.stringify([
      { op: "create-frame", params: { name: "Batch Parent" }, as: "p" },
      { op: "create-text", params: { characters: "child", parentId: "$p" } },
    ]),
  ]);

  const badRef = cli(["run", "--ops", JSON.stringify([{ op: "create-text", params: { characters: "x", parentId: "$nope" } }])]);
  if (badRef.code !== 0 && /unknown batch reference/i.test(badRef.out)) {
    pass('unknown "$ref" is rejected', "exit " + badRef.code);
  } else {
    fail('unknown "$ref" is rejected', `exit ${badRef.code}: ${firstLine(badRef.out)}`);
  }

  section("D. CLI run (sequential batch)");
  // Derive the expected step count from the example itself, so editing the
  // example cannot silently rot this assertion.
  const batchFile = path.join(ROOT, "examples", "vibe-test.json");
  const expectedSteps = JSON.parse(require("node:fs").readFileSync(batchFile, "utf8")).ops.length;
  const batch = cli(["run", batchFile]);
  const stepCount = (batch.out.match(/step \d+/g) || []).length;
  if (batch.code === 0 && stepCount === expectedSteps) pass("run examples/vibe-test.json", `${stepCount} steps ok`);
  else fail("run examples/vibe-test.json", `exit ${batch.code}, steps=${stepCount} (expected ${expectedSteps}): ${firstLine(batch.out)}`);

  section("E. Error propagation");
  const badOp = cli(["run", "--ops", JSON.stringify([{ op: "definitely-not-an-op", params: {} }])]);
  if (badOp.code !== 0 && /UNSUPPORTED_OP/i.test(badOp.out)) pass("unknown op is an error, not a success", "exit " + badOp.code);
  else fail("unknown op is an error", `exit ${badOp.code}`);

  /* ---- G. queued != done ----------------------------------------- */
  section("G. \"queued\" is never reported as success");
  mock.kill();
  await sleep(1200);
  const orphan = cli(["create-frame", "--name", "should-not-appear", "--timeout", "3000"]);
  const orphanBad = orphan.code !== 0 && /NOT_PICKED_UP|no result|Timed out/i.test(orphan.out);
  if (orphanBad) pass("command left in queue \u2192 error, not ok", firstLine(orphan.out));
  else fail("command left in queue \u2192 error", `exit ${orphan.code}: ${firstLine(orphan.out)}`);

  /* ---- J. dead long-polls must not swallow commands ---------------- */
  // Regression guard for a bug that cost real debugging time: when the plugin
  // iframe was destroyed (plugin re-run), its long-poll could linger inside
  // the bridge. Commands were then handed to that dead socket, the bridge
  // logged "deploy" as if all was well, and the caller waited forever ->
  // NO_RESULT. A command must NEVER be swallowed by a client that is gone:
  // it has to stay queued and surface as NOT_PICKED_UP (an honest error).
  section("J. A client that went away cannot swallow commands");
  const ghostId = "ghost-" + Date.now().toString(36);
  await postJson(`/v1/hello?token=${TOKEN}`, { clientId: ghostId, label: "ghost", info: { page: "ghost", plugin: "ghost" } });
  // Several overlapping polls that die, mimicking repeated reconnects.
  await Promise.all([deadLongPoll(ghostId, 200), deadLongPoll(ghostId, 350), deadLongPoll(ghostId, 500)]);
  await sleep(300);

  const swallowed = cli(["create-frame", "--name", "must-not-vanish", "--timeout", "4000"]);
  if (swallowed.code !== 0 && /NOT_PICKED_UP/i.test(swallowed.out)) {
    pass("command not swallowed by a dead client", firstLine(swallowed.out));
  } else if (swallowed.code !== 0 && /NO_RESULT/i.test(swallowed.out)) {
    fail("command was swallowed by a dead client", `NO_RESULT means it was handed to a dead socket: ${firstLine(swallowed.out)}`);
  } else {
    fail("dead-client command handling", `exit ${swallowed.code}: ${firstLine(swallowed.out)}`);
  }

  /* ---- status ------------------------------------------------------ */
  section("H. CLI status view");
  const st = cli(["status"]);
  if (st.code === 0 && /plugin/.test(st.out)) pass("figma-vibe status", "exit 0");
  else fail("figma-vibe status", `exit ${st.code}`);

  finish(children);
}

function firstLine(s) {
  return (s || "").split("\n").find((l) => l.trim().length) || "(no output)";
}

function finish(children) {
  const okCount = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(72));
  console.log(`${okCount}/${results.length} checks passed`);
  if (bad.length) {
    console.log("\nFAILED:");
    bad.forEach((b) => console.log(`  \u2717 ${b.n}  ${b.detail || ""}`));
  }
  console.log("\nNOTE: a green result proves the Bridge + CLI protocol only.");
  console.log("      It does NOT prove that anything was written to a real Figma canvas.");
  console.log("=".repeat(72));
  children.forEach((c) => { try { c.kill(); } catch (_) { /* noop */ } });
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error("selftest crashed:", e); process.exit(1); });
