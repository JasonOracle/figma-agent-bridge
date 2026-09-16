#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Release 打包：staging → 敏感扫描 → 文档引用校验 → RELEASE-MANIFEST → 最终压缩包。

v1.0.0（2026-09-16 自包含修复版）
  安装单元 = skills/ai-ui-designer/ 技能目录本身，该目录**自包含**：
    文档 / figma-plugin / bridge（零依赖）/ tools（L0 探针）/ LICENSE / references / assets
  复制这一个文件夹即可使用，无需访问源仓库。
  包根不再单列 bridge/（避免同一份桥在包内出现两处），改为包根 README.md 明示安装单元。

排除：release-checklist.md（开发者内部 QA 文档）、任何 .vibe/ 测试产物 / 临时脚本。
"""
import hashlib, io, json, os, re, shutil, sys, zipfile, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = "1.0.0"
STAGE = os.path.join(ROOT, "release", f"ai-ui-designer-{VERSION}")
ZIP = STAGE + ".zip"
SKILL = "skills/ai-ui-designer"
results = []
def check(ok, name):
    results.append((ok, name))
    print(("PASS" if ok else "FAIL"), name)

ROOT_README = """# AI UI Designer {v} — 发布包

一句话输入，自动完成 AI UI 设计全流程：设计定位 → 设计系统 → Figma 自动绘制 → 五维视觉审查（不达标自动修复，最多 3 轮）→ PNG / SVG / 交付清单导出。

## 怎么用（3 步）

**安装单元是 `{skill}/` 这个技能目录 —— 它自包含，复制过去就能用。**

1. **装技能**：把 `{skill}/` 整个复制到你的技能目录
   - WorkBuddy：`~/.workbuddy/skills/ai-ui-designer/`
   - CodeBuddy CLI：`~/.codebuddy/skills/ai-ui-designer/`
2. **连 Figma**（一次性，约 3 分钟）：见 `{skill}/SETUP.md`
3. **说一句话**：

   > 帮我设计一个现代 AI 健康管理 App 首页，要有健康评分、趋势图、健康建议和底部导航，整体高级简洁，适合 iPhone。

完整教程见 `{skill}/USER_GUIDE.md`。

## 包内有什么

| 路径 | 说明 |
|---|---|
| `{skill}/` | **技能本体（自包含）**：文档 + `figma-plugin/`（Figma 插件）+ `bridge/`（本地桥接，零依赖）+ `tools/`（运行环境自检）+ `references/` + `assets/` |
| `CHANGELOG.md` | 版本变更记录 |
| `LICENSE` | MIT（技能目录内另有一份，便于单独分发） |
| `RELEASE-MANIFEST.json` | 逐文件 SHA-256 清单 |

无需 `npm install`：桥接程序只使用 Node.js 内置模块（需 Node.js ≥ 18）。
""".format(v=VERSION, skill=SKILL)

# ---------- 1) staging ----------
if os.path.isdir(STAGE): shutil.rmtree(STAGE)
os.makedirs(STAGE)
SKILL_STAGE = os.path.join(STAGE, "skills", "ai-ui-designer")
shutil.copytree(os.path.join(ROOT, "skills", "ai-ui-designer"), SKILL_STAGE,
                ignore=shutil.ignore_patterns("release-checklist.md"))  # 开发者内部 QA 文档不随包

# —— 自包含补齐：桥 / 探针 / 许可证随技能目录分发 ——
os.makedirs(os.path.join(SKILL_STAGE, "bridge"))
shutil.copy(os.path.join(ROOT, "bridge", "server.js"), os.path.join(SKILL_STAGE, "bridge", "server.js"))
os.makedirs(os.path.join(SKILL_STAGE, "tools"))
shutil.copy(os.path.join(ROOT, "tools", "runtime-check.mjs"), os.path.join(SKILL_STAGE, "tools", "runtime-check.mjs"))
shutil.copy(os.path.join(ROOT, "LICENSE"), SKILL_STAGE)

# —— 包根 ——
shutil.copy(os.path.join(ROOT, "LICENSE"), STAGE)
shutil.copy(os.path.join(ROOT, "CHANGELOG.md"), STAGE)
io.open(os.path.join(STAGE, "README.md"), "w", encoding="utf-8", newline="\n").write(ROOT_README)
print("staging ready:", STAGE)

# ---------- 2) 最终敏感信息扫描 ----------
real_secrets = ["lLVJH0OnZPrkAqzarvhnBq", "RupGQGcwLGupuhMw4j3rqH", "cagx3s36dmu2l7fe6",
                "cuoes9o4lmu2rbj1i", "d890d12", "ghp_", "sk-", "AKIA"]
pat_personal = re.compile(r"C:\\\\Users\\\\[A-Za-z]|/c/Users|/d/|Administrator|JasonOracle\\\\", re.I)
# `.vibe/` 允许出现在「`.vibe/token`」这一用户可见说明中（Bridge 的 token 存放位置）
pat_history = re.compile(r"stage1\d|stage[5-9]-|elementadmin|e2e-final|\.vibe/(?!token|runtime-capability)", re.I)
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
check(not os.path.exists(os.path.join(SKILL_STAGE, "release-checklist.md")), "扫描-内部 QA 文档已排除")

# ---------- 3) 自包含不变量 ----------
check(os.path.isfile(os.path.join(STAGE, "README.md")), "包根存在 README.md")
check(not os.path.exists(os.path.join(STAGE, "bridge")), "包根不再单列 bridge/（避免两份桥）")
check(not os.path.exists(os.path.join(STAGE, "tools")), "包根不再单列 tools/")
for f in ("README.md", "SETUP.md", "USER_GUIDE.md", "SKILL.md", "LICENSE",
          "figma-plugin/manifest.json", "figma-plugin/code.js", "figma-plugin/ui.html",
          "bridge/server.js", "tools/runtime-check.mjs",
          "references/runtime-capability.md", "assets/templates/export-manifest.json"):
    check(os.path.isfile(os.path.join(SKILL_STAGE, f)), f"技能目录内自包含 {f}")

# ---------- 4) 文档引用校验（防 P2-001 复发：文档引用的脚本必须在包内存在） ----------
pat_cmd = re.compile(r"`?(?:node|python|python3)\s+([A-Za-z0-9_\-./]+\.(?:mjs|js|py))")
dangling = []
for dirpath, _, fns in os.walk(STAGE):
    for fn in fns:
        if not fn.endswith((".md", ".json")): continue
        p = os.path.join(dirpath, fn)
        try: s = io.open(p, encoding="utf-8").read()
        except Exception: continue
        for m in pat_cmd.finditer(s):
            rel = m.group(1).lstrip("./").replace("/", os.sep)
            # 文档中的相对路径可能以「包根」或「技能目录」或「文档同级」为基准
            bases = [STAGE, SKILL_STAGE, os.path.dirname(p)]
            if not any(os.path.isfile(os.path.join(b, rel)) for b in bases):
                dangling.append((os.path.relpath(p, STAGE).replace("\\", "/"), m.group(1)))
for f, rel in dangling: print(f"  dangling-ref: {f} → {rel}")
check(not dangling, f"文档命令引用无悬空（{len(dangling)}）")

# ---------- 5) 文件清单 + sha256 ----------
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
    "revision": "self-contained repack（2026-09-16：技能目录内补齐 bridge/tools/LICENSE，文档路径本地化）",
    "generatedAt": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "architecture": "FROZEN (no new layers / MCP / bridge changes after this release)",
    "contents": {
        "skill": f"{SKILL}/ (self-contained: docs + figma-plugin + bridge + tools + LICENSE + references + assets)",
        "runtime": f"{SKILL}/bridge/server.js (Node built-ins only)",
        "license": "MIT (package root + skill dir)",
        "changelog": "CHANGELOG.md",
    },
    "exclusions": ["release-checklist.md（开发者内部 QA 文档）", ".vibe/ 运行时数据", "测试产物", "开发日志", "临时脚本", "历史项目产物"],
    "sensitiveScan": {"patterns": ["real tokens/fileKeys", "personal paths", "history project names", ".vibe refs"],
                      "hits": len(scan_hits), "result": "CLEAN" if not scan_hits else "REVIEW"},
    "fileCount": len(files),
    "files": files,
}
io.open(os.path.join(STAGE, "RELEASE-MANIFEST.json"), "w", encoding="utf-8", newline="\n").write(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

# ---------- 6) 压缩包（zip 校验信息写仓库侧车文件，不进 zip，避免自引用） ----------
if os.path.exists(ZIP): os.remove(ZIP)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(files, key=lambda x: x["path"]):
        z.write(os.path.join(STAGE, f["path"]), f"ai-ui-designer-{VERSION}/{f['path']}")
zip_size = os.path.getsize(ZIP)
zip_sha = hashlib.sha256(io.open(ZIP, "rb").read()).hexdigest()
io.open(os.path.join(ROOT, "release", "RELEASE-INFO.json"), "w", encoding="utf-8", newline="\n").write(
    json.dumps({"releaseVersion": VERSION,
                "revision": manifest["revision"],
                "zip": {"path": f"release/ai-ui-designer-{VERSION}.zip", "bytes": zip_size, "sha256": zip_sha},
                "fileCount": len(files),
                "scan": manifest["sensitiveScan"]}, indent=2, ensure_ascii=False) + "\n")

passed = sum(1 for ok, _ in results if ok); failed = len(results) - passed
print(f"\n{passed} PASS / {failed} FAIL")
print(json.dumps({"zip": ZIP, "zipBytes": zip_size, "zipSha256": zip_sha, "fileCount": len(files)}, ensure_ascii=False))
sys.exit(1 if failed else 0)
