const http = require("http");
const { execSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { join, dirname } = require("path");

const PORT = 18080;
const CONFIG_PATH = "/root/.openclaw/openclaw.json";

// 服务商列表
const PROVIDERS = [
  { value: "openai", label: "OpenAI", hint: "Codex OAuth + API key" },
  { value: "anthropic", label: "Anthropic", hint: "setup-token + API key" },
  { value: "chutes", label: "Chutes", hint: "OAuth" },
  { value: "vllm", label: "vLLM", hint: "Local/self-hosted OpenAI-compatible" },
  { value: "minimax", label: "MiniMax", hint: "M2.5 (recommended)" },
  { value: "moonshot", label: "Moonshot AI (Kimi K2.5)", hint: "Kimi K2.5 + Kimi Coding" },
  { value: "google", label: "Google", hint: "Gemini API key + OAuth" },
  { value: "xai", label: "xAI (Grok)", hint: "API key" },
  { value: "mistral", label: "Mistral AI", hint: "API key" },
  { value: "volcengine", label: "Volcano Engine", hint: "API key" },
  { value: "byteplus", label: "BytePlus", hint: "API key" },
  { value: "openrouter", label: "OpenRouter", hint: "API key" },
  { value: "kilocode", label: "Kilo Gateway", hint: "API key" },
  { value: "qwen", label: "Qwen", hint: "OAuth" },
  { value: "zai", label: "Z.AI", hint: "GLM Coding Plan / Global / CN" },
  { value: "qianfan", label: "Qianfan", hint: "API key" },
  { value: "copilot", label: "Copilot", hint: "GitHub + local proxy" },
  { value: "ai-gateway", label: "Vercel AI Gateway", hint: "API key" },
  { value: "opencode-zen", label: "OpenCode Zen", hint: "API key" },
  { value: "xiaomi", label: "Xiaomi", hint: "API key" },
  { value: "synthetic", label: "Synthetic", hint: "Anthropic-compatible" },
  { value: "together", label: "Together AI", hint: "API key" },
  { value: "huggingface", label: "Hugging Face", hint: "HF token" },
  { value: "venice", label: "Venice AI", hint: "Privacy-focused" },
  { value: "litellm", label: "LiteLLM", hint: "Unified LLM gateway" },
  { value: "cloudflare-ai-gateway", label: "Cloudflare AI Gateway", hint: "Account ID + API key" },
  { value: "custom", label: "Custom Provider", hint: "OpenAI or Anthropic compatible" }
];

function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function writeConfig(config) {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'oc_';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getModels() {
  try {
    const output = execSync("openclaw models list --all 2>/dev/null", { encoding: "utf-8", timeout: 60000 });
    const lines = output.trim().split("\n").slice(1);
    const models = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0];
        const provider = key.split("/")[0];
        models.push({ provider, key, ctx: parts[2] || "" });
      }
    }
    return models;
  } catch (e) {
    console.error("Error getting models:", e.message);
    return [];
  }
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost:" + PORT);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 获取服务商列表
  if (pathname === "/api/providers") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(PROVIDERS));
    return;
  }

  // 获取模型列表
  if (pathname.startsWith("/api/models")) {
    const provider = url.searchParams.get("provider");
    let models = getModels();
    if (provider) {
      models = models.filter(m => m.provider.toLowerCase() === provider.toLowerCase());
    }
    if (models.length === 0) {
      models = getModels();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(models));
    return;
  }

  // 获取/设置配置
  if (pathname === "/api/config") {
    if (req.method === "GET") {
      const config = readConfig();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const newConfig = JSON.parse(body);
          const existingConfig = readConfig();
          // 合并配置
          const merged = { ...existingConfig, ...newConfig };
          writeConfig(merged);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
  }

  // 获取/生成 Token
  if (pathname === "/api/token") {
    if (req.method === "GET") {
      const config = readConfig();
      const token = config?.gateway?.auth?.token || null;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token }));
      return;
    }
    if (req.method === "POST") {
      const newToken = generateToken();
      const config = readConfig();
      if (!config.gateway) config.gateway = {};
      if (!config.gateway.auth) config.gateway.auth = {};
      config.gateway.auth.mode = "token";
      config.gateway.auth.token = newToken;
      writeConfig(config);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: newToken }));
      return;
    }
  }

  // 静态文件
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = join("/app/web-onboard/public", filePath);

  if (existsSync(fullPath)) {
    const ext = "." + (filePath.split(".").pop() || "html");
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(readFileSync(fullPath));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("Web Onboard server running on http://localhost:" + PORT);
});
