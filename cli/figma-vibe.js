#!/usr/bin/env node
/**
 * figma-vibe - CLI for the local Vibe Bridge write channel
 * ==================================================================
 * Submits structured JSON operations to the loopback bridge, which
 * relays them to the Figma plugin. Every command BLOCKS until the
 * plugin reports the real execution result (ok / error) - a queued or
 * pending state is never reported as success.
 *
 *   figma-vibe create-frame --name "Vibe Design Test" --width 1440 --height 900
 *   figma-vibe create-text  --text "Hello Vibe Design" --x 100 --y 260
 *   figma-vibe create-rect  --width 300 --height 100 --x 100 --y 100 --parent <frameId>
 *   figma-vibe run --ops '[{"op":"create-frame","params":{...}}]'
 *   figma-vibe run ops.json
 *   figma-vibe status | page | node <id> | delete-node <id>
 * ==================================================================
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TOKEN_FILE = path.join(ROOT, ".vibe", "token");

/* ------------------------------------------------------------------ */
/* tiny terminal helpers                                              */
/* ------------------------------------------------------------------ */

const USE_COLOR = !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (code, s) => (USE_COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const c = {
  ok: (s) => paint("32", s),
  bad: (s) => paint("31", s),
  dim: (s) => paint("2", s),
  bold: (s) => paint("1", s),
  cyan: (s) => paint("36", s),
  yellow: (s) => paint("33", s),
};

const die = (msg, code = 2) => { console.error(c.bad("error: ") + msg); process.exit(code); };

/* ------------------------------------------------------------------ */
/* args                                                               */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (key.includes("=")) {
        const [k, ...rest] = key.split("=");
        flags[k] = rest.join("=");
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) flags[key] = true;
        else { flags[key] = next; i++; }
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const asNum = (v) => (v === undefined || v === true ? undefined : Number(v));

const HELP = `
${c.bold("figma-vibe")} - write native nodes into Figma through a local bridge

${c.bold("USAGE")}
  figma-vibe <command> [options]

${c.bold("NODES")}
  create-frame   --name <n> --width <w> --height <h> [--x --y] [--parent <id>] [--hex] [--clips]
  create-rect    --width <w> --height <h> [--name] [--x --y] [--parent <id>] [--hex] [--radius <px>]
  create-ellipse --width <w> --height <h> [--name] [--x --y] [--parent <id>] [--hex <#rrggbb>]
  create-line    --length <l> [--name] [--x --y] [--rotation <deg>] [--parent <id>] [--hex]
  create-vector  --points "0,0 10,20 30,5" | --path "M 0 0 L 10 20" [--closed]
                 [--hex <stroke>] [--stroke-weight <px>] [--fill-hex <fill>] [--parent <id>]
  create-text    --text <s> [--size <px>] [--x --y] [--parent <id>] [--family --style] [--hex]
                 [--name <layer name>] [--autoresize none|width-and-height|height|truncate]
  set-name       <id> --name <layer name>
  delete-node    <id>
  duplicate-node <id> [--name] [--parent <id>] [--x --y]
  move-node      <id> [--x --y] [--dx --dy]
  resize-node    <id> [--width <w>] [--height <h>]

${c.bold("STYLE")}
  set-fill          <id> (--hex <#rrggbb> | --rgb "r,g,b") [--opacity 0.5] [--clear]
  set-stroke        <id> (--hex | --rgb) [--width <px>]
  set-opacity       <id> --opacity <0-1>
  set-corner-radius <id> --radius <px>
                    or [--top-left --top-right --bottom-left --bottom-right]
  set-effects       <id> [--shadow-x --shadow-y --shadow-blur --shadow-spread]
                    [--shadow-color <#rrggbb>] [--shadow-opacity <0-1>] [--blur <px>] [--clear]

${c.bold("TEXT")}
  set-font            <id> [--family <f>] [--style <s>]
  set-font-size       <id> --size <px>
  set-font-weight     <id> --weight <100-900> [--italic]
  set-text-color      <id> (--hex | --rgb)
  set-text-content    <id> --text <s>
  set-text-align      <id> [--horizontal left|center|right|justified] [--vertical top|center|bottom]
  set-text-autoresize <id> --mode none|width-and-height|height|truncate [--width <px>] [--height <px>]

${c.bold("AUTO LAYOUT")}
  set-auto-layout        <id> --mode <horizontal|vertical|none> [--spacing <px>] [--padding <px>]
  set-padding            <id> [--all <px>] | [--top --right --bottom --left] | [--horizontal --vertical]
  set-item-spacing       <id> --spacing <px>
  set-primary-axis-align <id> --align <min|center|max|space-between>
  set-counter-axis-align <id> --align <min|center|max|baseline>
  set-layout-sizing      <id> [--horizontal fixed|hug|fill] [--vertical fixed|hug|fill]

${c.bold("STRUCTURE")}
  append-child     <childId> --parent <parentId>
  create-component <nodeId> [--name <n>]
  create-instance  <componentId> [--x --y] [--parent <id>]

${c.bold("BATCH / READ")}
  run            --ops '<json>'   |   run <file.json>
                 parentId "@last" = the node created by the previous step
  page           read the current page back from Figma (verification)
  node <id>      read a single node's real state from Figma
  status         bridge + plugin connection status

${c.bold("GLOBAL OPTIONS")}
  --port <n>      bridge port            (default 45677)
  --host <h>      bridge host            (default 127.0.0.1, loopback only)
  --token <t>     override auth token    (default: .vibe/token)
  --timeout <ms>  how long to wait for the plugin's real result (default 15000)
  --json          print the raw JSON response
  --dry           print the request payload without sending it
  -h, --help

${c.bold("EXIT CODES")}
  0 = plugin executed and returned ok      1 = error / timeout      2 = usage
`;

/* ------------------------------------------------------------------ */
/* bridge client                                                      */
/* ------------------------------------------------------------------ */

function readToken(flagToken) {
  if (typeof flagToken === "string" && flagToken) return flagToken;
  if (process.env.VIBE_TOKEN) return process.env.VIBE_TOKEN;
  try {
    const t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (t) return t;
  } catch (_) { /* fall through */ }
  die(`no token found. Expected ${TOKEN_FILE} (created automatically when the bridge starts), or pass --token / set VIBE_TOKEN.`);
}

function request(host, port, method, pathname, token, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host,
        port,
        method,
        path: `${pathname}?token=${encodeURIComponent(token)}`,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": payload.length }
          : {},
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
    req.setTimeout(timeoutMs + 5000, () => {
      req.destroy(Object.assign(new Error(`no HTTP response within ${timeoutMs + 5000}ms`), { code: "HTTP_TIMEOUT" }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ------------------------------------------------------------------ */
/* output                                                             */
/* ------------------------------------------------------------------ */

function describeNode(data) {
  const n = data && data.created ? data.created : data && data.deleted ? data.deleted : null;
  if (!n) return "";
  const size = n.width !== undefined ? ` ${Math.round(n.width)}x${Math.round(n.height)}` : "";
  const text = n.characters ? ` "${n.characters}"` : "";
  return `${c.cyan(n.type)} ${c.bold(n.id)} \u201c${n.name}\u201d${size}${text}`;
}

function reportSuccess(op, data, elapsedMs) {
  const created = data && data.created;
  if (op === "run" && data && Array.isArray(data.ops)) {
    console.log(c.ok("ok") + "  " + c.bold("run") + "  " + c.dim(elapsedMs + "ms") + `  ${data.count} ops executed in Figma`);
    data.ops.forEach((s) => console.log("    " + c.dim("step " + s.step) + "  " + describeNode(s.data)));
    return;
  }
  console.log(c.ok("ok") + "  " + c.bold(op) + "  " + c.dim(elapsedMs + "ms") + "  " + (describeNode(data) || JSON.stringify(data)));
  if (created && created.parentId) console.log("    " + c.dim("parent: " + created.parentId));
}

/* ------------------------------------------------------------------ */
/* commands                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* command table                                                       */
/*                                                                     */
/* Commands are DECLARED, not coded: every entry maps CLI flags onto   */
/* the params the plugin expects. Readers take (flags, positional).    */
/* ------------------------------------------------------------------ */

const F = {
  str: (key, dflt) => (f) => (typeof f[key] === "string" ? f[key] : dflt),
  num: (key) => (f) => asNum(f[key]),
  bool: (key) => (f) => (f[key] === true || f[key] === "true" ? true : f[key] === "false" ? false : undefined),
  pos: (i) => (f, a) => a[i],
  /** First reader that yields a value wins - used for flag aliases. */
  one: (...readers) => (f, a) => {
    for (const r of readers) {
      const v = r(f, a);
      if (v !== undefined) return v;
    }
    return undefined;
  },
};

/** --points "0,0 10,20 30,5"  |  --points '[[0,0],[10,20]]'  ->  [[x,y], ...] */
function pointsFromFlags(f) {
  const raw = typeof f.points === "string" ? f.points.trim() : undefined;
  if (!raw) return undefined;
  if (raw.startsWith("[")) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { die(`--points is not valid JSON: ${e.message}`); }
    if (!Array.isArray(parsed)) die("--points JSON must be an array of [x, y] pairs");
    return parsed;
  }
  const pts = raw.split(/\s+/).map((pair) => pair.split(",").map((n) => Number(n.trim())));
  if (pts.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))) {
    die(`--points must look like "0,0 10,20 30,5", got "${raw}"`);
  }
  return pts;
}

/** --shadow-x/y/blur/spread/color/opacity  ->  { x, y, blur, spread, color, opacity } */
function shadowFromFlags(f) {
  const keys = ["shadow-x", "shadow-y", "shadow-blur", "shadow-spread", "shadow-color", "shadow-opacity"];
  if (!keys.some((k) => f[k] !== undefined)) return undefined;
  return {
    x: asNum(f["shadow-x"]), y: asNum(f["shadow-y"]),
    blur: asNum(f["shadow-blur"]), spread: asNum(f["shadow-spread"]),
    color: typeof f["shadow-color"] === "string" ? f["shadow-color"] : undefined,
    opacity: asNum(f["shadow-opacity"]),
  };
}

/** --hex "#4a6cff" | --rgb "74,108,255" | [--opacity 0.5]  ->  colour spec */
function colourFromFlags(f) {
  const spec = {};
  const hex = typeof f.hex === "string" ? f.hex : typeof f.color === "string" ? f.color : undefined;
  if (hex) spec.hex = hex;
  if (typeof f.rgb === "string") {
    const parts = f.rgb.split(",").map((s) => Number(s.trim()));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      die(`--rgb must look like "74,108,255" (0-255 per channel), got "${f.rgb}"`);
    }
    spec.rgb = parts;
  }
  if (f.opacity !== undefined) spec.opacity = asNum(f.opacity);
  return Object.keys(spec).length ? spec : undefined;
}

const COMMANDS = {
  /* ---- group 1: node creation / manipulation ---- */
  "create-frame": {
    op: "create-frame",
    params: {
      name: F.str("name", "Frame"), width: F.num("width"), height: F.num("height"),
      x: F.num("x"), y: F.num("y"), parentId: F.str("parent"),
      fill: colourFromFlags, clips: F.bool("clips"),
    },
  },
  "create-rect": {
    op: "create-rect",
    params: {
      name: F.str("name", "Rectangle"), width: F.num("width"), height: F.num("height"),
      x: F.num("x"), y: F.num("y"), parentId: F.str("parent"), fill: colourFromFlags,
      cornerRadius: F.num("radius"),
    },
  },
  "create-ellipse": {
    op: "create-ellipse",
    params: {
      name: F.str("name", "Ellipse"), width: F.num("width"), height: F.num("height"),
      x: F.num("x"), y: F.num("y"), parentId: F.str("parent"), fill: colourFromFlags,
    },
  },
  "create-line": {
    op: "create-line",
    params: {
      name: F.str("name", "Line"), length: F.one(F.num("length"), F.num("width")),
      x: F.num("x"), y: F.num("y"), rotation: F.num("rotation"), parentId: F.str("parent"),
      stroke: colourFromFlags, strokeWeight: F.num("stroke-weight"),
    },
  },
  "create-vector": {
    op: "create-vector",
    params: {
      name: F.str("name", "Vector"), points: pointsFromFlags, data: F.str("path"),
      closed: F.bool("closed"),
      x: F.num("x"), y: F.num("y"), width: F.num("width"), height: F.num("height"),
      parentId: F.str("parent"),
      stroke: colourFromFlags, strokeWeight: F.one(F.num("stroke-weight"), F.num("weight")),
      strokeCap: F.str("cap"), strokeJoin: F.str("join"),
      fill: (f) => {
        const hex = typeof f["fill-hex"] === "string" ? f["fill-hex"] : undefined;
        if (!hex) return undefined;
        const spec = { hex };
        if (f["fill-opacity"] !== undefined) spec.opacity = asNum(f["fill-opacity"]);
        return spec;
      },
    },
  },
  "create-text": {
    op: "create-text",
    params: {
      characters: F.one(F.str("text"), F.str("characters")),
      fontSize: F.one(F.num("size"), F.num("font-size"), F.num("fontSize")),
      x: F.num("x"), y: F.num("y"), parentId: F.str("parent"),
      fontFamily: F.str("family"), fontStyle: F.str("style"), fill: colourFromFlags,
      name: F.str("name"), autoResize: F.str("autoresize"),
    },
  },
  "delete-node": { op: "delete-node", params: { id: F.pos(0) } },
  "set-name": { op: "set-name", params: { id: F.pos(0), name: F.str("name") } },
  "duplicate-node": {
    op: "duplicate-node",
    params: { id: F.pos(0), name: F.str("name"), parentId: F.str("parent"), x: F.num("x"), y: F.num("y") },
  },
  "move-node": {
    op: "move-node",
    params: { id: F.pos(0), x: F.num("x"), y: F.num("y"), dx: F.num("dx"), dy: F.num("dy") },
  },
  "resize-node": {
    op: "resize-node",
    params: { id: F.pos(0), width: F.num("width"), height: F.num("height") },
  },

  /* ---- group 2: style ---- */
  "set-fill": {
    op: "set-fill",
    params: { id: F.pos(0), color: colourFromFlags, clear: F.bool("clear") },
  },
  "set-stroke": {
    op: "set-stroke",
    params: {
      id: F.pos(0), color: colourFromFlags,
      width: F.one(F.num("width"), F.num("stroke-weight")),
    },
  },
  "set-opacity": { op: "set-opacity", params: { id: F.pos(0), opacity: F.num("opacity") } },
  "set-corner-radius": {
    op: "set-corner-radius",
    params: {
      id: F.pos(0), radius: F.num("radius"),
      topLeft: F.num("top-left"), topRight: F.num("top-right"),
      bottomLeft: F.num("bottom-left"), bottomRight: F.num("bottom-right"),
    },
  },
  "set-effects": {
    op: "set-effects",
    params: { id: F.pos(0), shadow: shadowFromFlags, blur: F.num("blur"), clear: F.bool("clear") },
  },

  /* ---- group 3: text ---- */
  "set-font": { op: "set-font", params: { id: F.pos(0), family: F.str("family"), style: F.str("style") } },
  "set-font-size": {
    op: "set-font-size",
    params: { id: F.pos(0), size: F.one(F.num("size"), F.num("font-size")) },
  },
  "set-font-weight": {
    op: "set-font-weight",
    params: { id: F.pos(0), weight: F.num("weight"), italic: F.bool("italic") },
  },
  "set-text-color": { op: "set-text-color", params: { id: F.pos(0), color: colourFromFlags } },
  "set-text-content": {
    op: "set-text-content",
    params: { id: F.pos(0), characters: F.one(F.str("text"), F.str("characters")) },
  },
  "set-text-align": {
    op: "set-text-align",
    params: { id: F.pos(0), horizontal: F.str("horizontal"), vertical: F.str("vertical") },
  },
  "set-text-autoresize": {
    op: "set-text-autoresize",
    params: { id: F.pos(0), mode: F.str("mode"), width: F.num("width"), height: F.num("height") },
  },

  /* ---- group 4: auto layout ---- */
  "set-auto-layout": {
    op: "set-auto-layout",
    params: {
      id: F.pos(0), mode: F.str("mode"), spacing: F.num("spacing"), padding: F.num("padding"),
      primaryAxisSizingMode: F.str("primary-sizing"), counterAxisSizingMode: F.str("counter-sizing"),
    },
  },
  "set-padding": {
    op: "set-padding",
    params: {
      id: F.pos(0), all: F.num("all"), top: F.num("top"), right: F.num("right"),
      bottom: F.num("bottom"), left: F.num("left"),
      horizontal: F.num("horizontal"), vertical: F.num("vertical"),
    },
  },
  "set-item-spacing": { op: "set-item-spacing", params: { id: F.pos(0), spacing: F.num("spacing") } },
  "set-primary-axis-align": {
    op: "set-primary-axis-align",
    params: { id: F.pos(0), align: F.str("align") },
  },
  "set-counter-axis-align": {
    op: "set-counter-axis-align",
    params: { id: F.pos(0), align: F.str("align") },
  },
  "set-layout-sizing": {
    op: "set-layout-sizing",
    params: { id: F.pos(0), horizontal: F.str("horizontal"), vertical: F.str("vertical") },
  },

  /* ---- group 5: structure ---- */
  "append-child": {
    op: "append-child",
    params: { childId: F.one(F.pos(0), F.str("child")), parentId: F.one(F.str("parent"), F.pos(1)) },
  },
  "create-component": {
    op: "create-component",
    params: { id: F.one(F.pos(0), F.str("from")), name: F.str("name") },
  },
  "create-instance": {
    op: "create-instance",
    params: {
      componentId: F.one(F.pos(0), F.str("component")),
      x: F.num("x"), y: F.num("y"), parentId: F.str("parent"),
    },
  },
};

function buildCommand(name, positional, flags) {
  const spec = COMMANDS[name];
  if (!spec) return null;
  const params = {};
  for (const key of Object.keys(spec.params)) {
    params[key] = spec.params[key](flags, positional);
  }
  return { op: spec.op, params };
}

/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2);
  const { flags, positional } = parseArgs(argv);
  const name = positional[0];

  if (!name || flags.help || name === "help") { console.log(HELP); process.exit(name ? 0 : 2); }

  const host = typeof flags.host === "string" ? flags.host : "127.0.0.1";
  const port = Number(flags.port) || Number(process.env.VIBE_PORT) || 45677;
  const timeoutMs = Number(flags.timeout) || 15000;
  const raw = flags.json === true;

  /* ---- status: does not need the plugin to be up ---- */
  if (name === "status") {
    const { status, body } = await request(host, port, "GET", "/health", readToken(flags.token), undefined, 5000)
      .catch((e) => ({ status: 0, body: { error: { message: e.message, code: e.code || "ECONNREFUSED" } } }));

    if (raw) { console.log(JSON.stringify(body, null, 2)); process.exit(status === 200 ? 0 : 1); }
    if (status !== 200) {
      console.log(c.bad("bridge: unreachable") + `  http://${host}:${port}`);
      console.log(c.dim("start it with:  node bridge/server.js"));
      process.exit(1);
    }
    const p = body.plugin || {};
    console.log(c.bold("Vibe Bridge") + c.dim(`  http://${host}:${port}`));
    console.log(`  plugin     ${p.connected ? c.ok("connected") : c.bad("offline")}` +
      (p.lastSeenAgoMs !== null && p.lastSeenAgoMs !== undefined ? c.dim(`  (last poll ${Math.round(p.lastSeenAgoMs / 1000)}s ago)`) : ""));
    if (p.info) console.log(c.dim(`             page "${p.info.page}" ${p.info.pageId || ""}`));
    console.log(`  queued     ${body.queue}`);
    console.log(`  in-flight  ${body.inflight}`);
    if (Array.isArray(body.recent) && body.recent.length) {
      console.log(c.bold("  recent"));
      body.recent.slice().reverse().forEach((r) => {
        const mark = r.status === "ok" ? c.ok("ok   ") : c.bad("error");
        console.log(`    ${mark} ${r.op || "-"} ${c.dim(r.id)} ${r.nodeId ? c.cyan(r.nodeId) : ""} ${r.error ? c.bad(r.error) : ""}`);
      });
    }
    process.exit(0);
  }

  /* ---- run: batch ---- */
  let command;
  if (name === "run") {
    let spec = flags.ops;
    const file = positional[1] || (typeof flags.file === "string" ? flags.file : undefined);
    if (!spec && file) {
      try { spec = fs.readFileSync(path.resolve(process.cwd(), file), "utf8"); }
      catch (e) { die(`cannot read ops file ${file}: ${e.message}`); }
    }
    if (!spec) die("run needs --ops '<json>' or a path to a .json file");
    let parsed;
    try { parsed = typeof spec === "string" ? JSON.parse(spec) : spec; }
    catch (e) { die("--ops is not valid JSON: " + e.message); }
    const ops = Array.isArray(parsed) ? parsed : parsed.ops;
    if (!Array.isArray(ops) || ops.length === 0) die("ops payload must be a non-empty array, or {\"ops\": [...]}");
    command = { op: "run", params: { ops } };
  } else if (name === "page") {
    command = { op: "get-page-summary", params: {} };
  } else if (name === "node") {
    if (!positional[1]) die("node needs a node id:  figma-vibe node <id>");
    command = { op: "get-node", params: { id: positional[1] } };
  } else if (name === "ping") {
    command = { op: "ping", params: {} };
  } else {
    command = buildCommand(name, positional.slice(1), flags);
    if (!command) die(`unknown command "${name}". Run figma-vibe --help for the list.`);
  }

  // strip undefined params so the plugin sees a clean payload
  Object.keys(command.params).forEach((k) => command.params[k] === undefined && delete command.params[k]);

  if (flags.dry === true) {
    console.log(c.dim("POST ") + `http://${host}:${port}/v1/command`);
    console.log(JSON.stringify(command, null, 2));
    process.exit(0);
  }

  const token = readToken(flags.token);
  const started = Date.now();
  let res;
  try {
    res = await request(host, port, "POST", "/v1/command", token, { ...command, timeoutMs }, timeoutMs + 5000);
  } catch (e) {
    if (e.code === "ECONNREFUSED") die(`bridge not reachable on http://${host}:${port} - start it with:  node bridge/server.js`, 1);
    die(e.message, 1);
    return;
  }

  const elapsed = Date.now() - started;

  if (raw) { console.log(JSON.stringify(res.body, null, 2)); process.exit(res.status === 200 ? 0 : 1); }

  if (res.status === 200 && res.body && res.body.ok) {
    reportSuccess(command.op, res.body.data, res.body.elapsedMs ?? elapsed);
    process.exit(0);
  }

  const err = (res.body && res.body.error) || { code: "UNKNOWN", message: `HTTP ${res.status}` };
  console.log(c.bad("error") + "  " + c.bold(command.op) + "  " + c.dim(elapsed + "ms"));
  console.log("  " + c.bad(err.code) + "  " + err.message);
  if (err.code === "PLUGIN_OFFLINE") {
    console.log(c.dim("\n  Open Figma Desktop and run the plugin:"));
    console.log(c.dim("    Plugins > Development > Vibe Bridge (Dev)"));
    console.log(c.dim("  The panel must show a green dot / 'connected' before commands can land."));
  }
  if (err.partial) {
    console.log(c.yellow("\n  steps that did succeed before the failure:"));
    err.partial.forEach((s) => console.log("    " + c.dim("step " + s.step) + "  " + describeNode(s.data)));
  }
  process.exit(1);
}

main().catch((e) => { console.error(c.bad("unexpected: ") + (e && e.stack ? e.stack : e)); process.exit(1); });
