#!/usr/bin/env node
/**
 * mock-plugin.js - protocol test double. NOT the real Figma plugin.
 * ------------------------------------------------------------------
 * Speaks the exact same bridge protocol as plugin/ui.html so that the
 * Bridge + CLI chain can be verified end-to-end without Figma.
 *
 * It returns synthetic node ids prefixed with "MOCK:" so results can
 * never be confused with real Figma nodes.
 *
 * !! Stop this before running the real Figma plugin - both compete for
 *    the same command queue and only one will win each command.
 * ------------------------------------------------------------------
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const HOST = flag("host", "127.0.0.1");
const PORT = Number(flag("port", 45677));
const TOKEN = String(flag("token", "")) || fs.readFileSync(path.join(__dirname, "..", ".vibe", "token"), "utf8").trim();

let seq = 0;
// The bridge refuses to hand out commands to unregistered clients, so the mock
// must register itself exactly like the real plugin UI does.
const CLIENT_ID = "mock-" + Math.random().toString(36).slice(2, 8);
const stamp = () => new Date().toTimeString().slice(0, 8);

function req(method, pathname, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request(
      {
        host: HOST, port: PORT, method,
        path: `${pathname}${pathname.includes("?") ? "&" : "?"}token=${encodeURIComponent(TOKEN)}`,
        headers: payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = { raw: text }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.setTimeout(timeoutMs, () => r.destroy(new Error("mock: request timeout")));
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function mockErr(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const MOCK_TYPES = {
  "create-frame": "FRAME",
  "create-rect": "RECTANGLE",
  "create-ellipse": "ELLIPSE",
  "create-line": "LINE",
  "create-vector": "VECTOR",
  "create-text": "TEXT",
  "create-component": "COMPONENT",
  "create-instance": "INSTANCE",
};

/**
 * Ops this mock knows how to fake. Prefix families mean a newly added
 * capability needs no edit here, while a genuinely unknown op still fails
 * loudly with UNSUPPORTED_OP - exactly like the real plugin.
 */
const KNOWN_OP = /^(ping|run|get-page-summary|get-node|create-[a-z][a-z-]*|duplicate-node|delete-node|move-node|resize-node|set-[a-z][a-z-]*|append-child)$/;

/**
 * Pretend to run the op through the Plugin API.
 *
 * Deliberately generic: ops are bucketed by prefix instead of being listed
 * one by one, so adding a new capability to the plugin does not silently
 * turn its self-test into an UNSUPPORTED_OP failure.
 */
function fakeExec(op, params) {
  const id = `MOCK:${op}:${++seq}`;
  const p = params || {};

  if (!KNOWN_OP.test(op)) throw mockErr(`Unsupported op "${op}". Supported: ...`, "UNSUPPORTED_OP");

  if (op === "ping") return { plugin: "MOCK", page: "Mock Page", pageId: "0:0" };
  if (op === "get-page-summary") return { page: { id: "0:0", name: "Mock Page" }, nodes: [], nodeCount: 0 };
  if (op === "get-node") {
    if (!p.id) throw mockErr("Missing required param: id", "BAD_PARAM");
    return { id: p.id, name: "mock node", type: "NODE" };
  }

  if (op === "run") {
    const ops = p.ops || [];
    let lastCreated = null;
    const named = {};
    const results = [];
    for (let i = 0; i < ops.length; i++) {
      const step = ops[i] || {};
      const stepParams = Object.assign({}, step.params || {});
      // Mirrors the plugin's "@last" / "$name" resolution so a batch can be
      // exercised end to end here. This is a simulation - real behaviour still
      // has to be proven against a real Figma canvas.
      const ID_FIELDS = ["id", "parentId", "childId", "nodeId", "componentId", "targetId", "from"];
      Object.keys(stepParams).forEach((k) => {
        const v = stepParams[k];
        if (v !== "@last" && !(typeof v === "string" && v.startsWith("$"))) return;
        if (!ID_FIELDS.includes(k)) {
          throw mockErr(`Step ${i}: "${v}" is only valid in node-reference params, not "${k}"`, "BAD_PARAM");
        }
        if (v === "@last") {
          if (lastCreated) stepParams[k] = lastCreated;
          else throw mockErr(`Step ${i}: "@last" but no earlier step created a node`, "BAD_PARAM");
        } else {
          const target = named[v.slice(1)];
          if (!target) throw mockErr(`Step ${i}: unknown batch reference "${v}"`, "BAD_PARAM");
          stepParams[k] = target;
        }
      });
      const data = fakeExec(step.op, stepParams);
      if (data && data.created && data.created.id) {
        lastCreated = data.created.id;
        if (typeof step.as === "string" && step.as) named[step.as] = data.created.id;
      }
      results.push({ step: i, op: step.op, ok: true, data });
    }
    return { ops: results, count: results.length };
  }

  const isCreate = /^(create|duplicate)-/.test(op);
  const target = p.id || p.nodeId || p.childId || p.from || p.componentId;

  // Node-targeting ops must name a node, exactly like the real plugin does.
  if (!isCreate && op !== "append-child" && !target) {
    throw mockErr(`Missing required param: id`, "BAD_PARAM");
  }

  if (op.startsWith("delete-")) {
    return { op, deleted: { id: p.id, name: "deleted", type: "NODE" } };
  }

  if (isCreate) {
    return {
      op,
      created: {
        id,
        name: p.name || p.characters || op,
        type: MOCK_TYPES[op] || "NODE",
        width: p.width || 0,
        height: p.height || 0,
        x: p.x || 0,
        y: p.y || 0,
        parentId: p.parentId,
        layoutMode: p.mode ? String(p.mode).toUpperCase() : undefined,
      },
    };
  }

  if (op === "append-child") {
    return { op, updated: { id: p.childId || p.id, parentId: p.parentId }, parentId: p.parentId };
  }

  return { op, updated: { id: target, name: "mock node", type: "NODE" }, applied: Object.keys(p) };
}

async function main() {
  console.log(`[mock-plugin] polling ${HOST}:${PORT} as a fake "Figma plugin"`);
  console.log(`[mock-plugin] node ids will be prefixed with MOCK: - this proves the bridge/CLI chain only.`);
  await req("POST", "/v1/hello", { clientId: CLIENT_ID, label: "mock-plugin", info: { page: "Mock Page", pageId: "0:0", mock: true } }).catch(() => {});
  for (;;) {
    try {
      const poll = await req("GET", `/v1/poll?wait=15000&client=${CLIENT_ID}`, undefined, 40000);
      if (!poll.body || !poll.body.cmd) continue;
      const cmd = poll.body.cmd;
      console.log(`[mock-plugin] ${stamp()} <- ${cmd.id} ${cmd.op} ${JSON.stringify(cmd.params)}`);
      try {
        const data = fakeExec(cmd.op, cmd.params || {});
        await req("POST", `/v1/result?client=${CLIENT_ID}`, { id: cmd.id, ok: true, data });
        console.log(`[mock-plugin] ${stamp()} -> ${cmd.id} ok`);
      } catch (e) {
        await req("POST", `/v1/result?client=${CLIENT_ID}`, { id: cmd.id, ok: false, error: { message: e.message, code: e.code || "MOCK_ERROR" } });
        console.log(`[mock-plugin] ${stamp()} -> ${cmd.id} ERROR ${e.message}`);
      }
    } catch (e) {
      console.log(`[mock-plugin] bridge error: ${e.message} (retrying)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

main();
