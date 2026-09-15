#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Release Freeze 打包：staging → 敏感扫描 → RELEASE-MANIFEST → 最终压缩包。
包内容 = skills/ai-ui-designer/** + bridge/server.js（零依赖）+ LICENSE + CHANGELOG。
排除：release-checklist.md（开发者内部 QA 文档）、任何 .vibe/测试产物/临时脚本。"""
import hashlib, io, json, os, re, shutil, sys, zipfile, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = "1.0.0"
STAGE = os.path.join(ROOT, "release", f"ai-ui-designer-{VERSION}")
ZIP = STAGE + ".zip"
results = []
def check(ok, name):
    results.append((ok, name))
    print(("PASS" if ok else "FAIL"), name)

# ---------- 1) staging ----------
if os.path.isdir(STAGE): shutil.rmtree(STAGE)
os.makedirs(os.path.join(STAGE, "skills"))
shutil.copytree(os.path.join(ROOT, "skills", "ai-ui-designer"), os.path.join(STAGE, "skills", "ai-ui-designer"),
                ignore=shutil.ignore_patterns("release-checklist.md"))  # 开发者内部 QA 文档不随包
os.makedirs(os.path.join(STAGE, "bridge"))
shutil.copy(os.path.join(ROOT, "bridge", "server.js"), os.path.join(STAGE, "bridge", "server.js"))
shutil.copy(os.path.join(ROOT, "LICENSE"), STAGE)
shutil.copy(os.path.join(ROOT, "CHANGELOG.md"), STAGE)
print("staging ready:", STAGE)

# ---------- 2) 最终敏感信息扫描 ----------
real_secrets = ["lLVJH0OnZPrkAqzarvhnBq", "RupGQGcwLGupuhMw4j3rqH", "cagx3s36dmu2l7fe6",
                "cuoes9o4lmu2rbj1i", "d890d12", "ghp_", "sk-", "AKIA"]
pat_personal = re.compile(r"C:\\\\Users\\\\[A-Za-z]|/c/Users|/d/|Administrator|JasonOracle\\\\", re.I)
pat_history = re.compile(r"stage1\d|stage[5-9]-|elementadmin|e2e-final|\.vibe/", re.I)
ALLOW_SERVICE = re.compile(r"figma-vibe-bridge")  # 协议常量豁免（Bridge 服务标识）
scan_hits = []
for dirpath, _, files in os.walk(STAGE):
    for fn in files:
        p = os.path.join(dirpath, fn)
        if fn.endswith((".png", ".svg")): continue
        try: s = io.open(p, encoding="utf-8").read()
        except Exception: continue
        for secret in real_secrets:
            if secret in s: scan_hits.append(("SECRET", os.path.relpath(p, STAGE), secret))
        for m in pat_personal.finditer(s): scan_hits.append(("PERSONAL", os.path.relpath(p, STAGE), m.group()))
        for m in pat_history.finditer(s):
            if ALLOW_SERVICE.search(s[max(0, m.start()-30):m.end()+30]): continue
            scan_hits.append(("HISTORY", os.path.relpath(p, STAGE), m.group()))
for kind, rel, hit in scan_hits: print("  scan-hit:", kind, rel, repr(hit))
check(not [h for h in scan_hits if h[0] in ("SECRET", "PERSONAL")], f"扫描-机密/个人路径（{len([h for h in scan_hits if h[0] in ('SECRET','PERSONAL')])}）")
check(not [h for h in scan_hits if h[0] == "HISTORY"], f"扫描-历史项目残留（{len([h for h in scan_hits if h[0]=='HISTORY'])}）")
check(not [p for p in ("release-checklist.md",) if os.path.exists(os.path.join(STAGE, "skills/ai-ui-designer", p))], "扫描-内部 QA 文档已排除")
for f in ("skills/ai-ui-designer/README.md", "skills/ai-ui-designer/SETUP.md", "skills/ai-ui-designer/USER_GUIDE.md",
          "skills/ai-ui-designer/SKILL.md", "skills/ai-ui-designer/figma-plugin/manifest.json",
          "bridge/server.js", "LICENSE", "CHANGELOG.md"):
    check(os.path.isfile(os.path.join(STAGE, f)), f"包内存在 {f}")

# ---------- 3) 文件清单 + sha256 ----------
files = []
for dirpath, _, fns in os.walk(STAGE):
    for fn in fns:
        p = os.path.join(dirpath, fn)
        files.append({"path": os.path.relpath(p, STAGE).replace("\\", "/"),
                      "bytes": os.path.getsize(p),
                      "sha256": hashlib.sha256(io.open(p, "rb").read()).hexdigest()})
files.append({"path": "RELEASE-MANIFEST.json", "bytes": 0, "sha256": "-"})  # 自身条目（bytes 0 标记自引用）
manifest = {
    "releaseVersion": VERSION,
    "generatedAt": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "architecture": "FROZEN (no new layers / MCP / bridge changes after this release)",
    "contents": {"skill": "skills/ai-ui-designer/", "runtime": "bridge/server.js (Node built-ins only)", "license": "MIT", "changelog": "CHANGELOG.md"},
    "exclusions": ["release-checklist.md（开发者内部 QA 文档）", ".vibe/ 运行时数据", "测试产物", "开发日志", "临时脚本", "历史项目产物"],
    "sensitiveScan": {"patterns": ["real tokens/fileKeys", "personal paths", "history project names", ".vibe refs"],
                      "hits": len(scan_hits), "result": "CLEAN" if not scan_hits else "REVIEW"},
    "fileCount": len(files),
    "files": files,
}
io.open(os.path.join(STAGE, "RELEASE-MANIFEST.json"), "w", encoding="utf-8", newline="\n").write(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

# ---------- 4) 压缩包（zip 校验信息写仓库侧车文件，不进 zip，避免自引用） ----------
if os.path.exists(ZIP): os.remove(ZIP)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(files, key=lambda x: x["path"]):
        z.write(os.path.join(STAGE, f["path"]), f"ai-ui-designer-{VERSION}/{f['path']}")
zip_size = os.path.getsize(ZIP)
zip_sha = hashlib.sha256(io.open(ZIP, "rb").read()).hexdigest()
io.open(os.path.join(ROOT, "release", "RELEASE-INFO.json"), "w", encoding="utf-8", newline="\n").write(
    json.dumps({"releaseVersion": VERSION,
                "zip": {"path": f"release/ai-ui-designer-{VERSION}.zip", "bytes": zip_size, "sha256": zip_sha},
                "fileCount": len(files),
                "scan": manifest["sensitiveScan"]}, indent=2, ensure_ascii=False) + "\n")

passed = sum(1 for ok, _ in results if ok); failed = len(results) - passed
print(f"\n{passed} PASS / {failed} FAIL")
print(json.dumps({"zip": ZIP, "zipBytes": zip_size, "zipSha256": zip_sha, "fileCount": len(files)}, ensure_ascii=False))
sys.exit(1 if failed else 0)
