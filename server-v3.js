const http = require("http");
const { execSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { join, dirname } = require("path");

const PORT = 18080;
const CONFIG_PATH = "/root/.openclaw/openclaw.json";

// 完整的服务商列表 - 从 openclaw 源码提取
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
  { value: "kilocode", label: "Kilo Gateway", hint: "API key (OpenRouter-compatible)" },
  { value: "qwen", label: "Qwen", hint: "OAuth" },
  { value: "zai", label: "Z.AI", hint: "GLM Coding Plan / Global / CN" },
  { value: "qianfan", label: "Qianfan", hint: "API key" },
  { value: "copilot", label: "Copilot", hint: "GitHub + local proxy" },
  { value: "ai-gateway", label: "Vercel AI Gateway", hint: "API key" },
  { value: "opencode-zen", label: "OpenCode Zen", hint: "API key" },
  { value: "xiaomi", label: "Xiaomi", hint: "API key" },
  { value: "synthetic", label: "Synthetic", hint: "Anthropic-compatible (multi-model)" },
  { value: "together", label: "Together AI", hint: "API key" },
  { value: "huggingface", label: "Hugging Face", hint: "Inference API (HF token)" },
  { value: "venice", label: "Venice AI", hint: "Privacy-focused (uncensored models)" },
  { value: "litellm", label: "LiteLLM", hint: "Unified LLM gateway (100+ providers)" },
  { value: "cloudflare-ai-gateway", label: "Cloudflare AI Gateway", hint: "Account ID + Gateway ID + API key" },
  { value: "custom", label: "Custom Provider", hint: "Any OpenAI or Anthropic compatible endpoint" },
];

// 服务商到认证方式的映射
const PROVIDER_AUTH = {
  "openai": "openai-api-key",
  "anthropic": "apiKey",
  "chutes": "chutes",
  "vllm": "vllm",
  "minimax": "minimax-api-key-cn",
  "moonshot": "moonshot-api-key",
  "google": "gemini-api-key",
  "xai": "xai-api-key",
  "mistral": "mistral-api-key",
  "volcengine": "volcengine-api-key",
  "byteplus": "byteplus-api-key",
  "openrouter": "openrouter-api-key",
  "kilocode": "kilocode-api-key",
  "qwen": "qwen-portal",
  "zai": "zai-coding-global",
  "qianfan": "qianfan-api-key",
  "copilot": "github-copilot",
  "ai-gateway": "ai-gateway-api-key",
  "opencode-zen": "opencode-zen",
  "xiaomi": "xiaomi-api-key",
  "synthetic": "synthetic-api-key",
  "together": "together-api-key",
  "huggingface": "huggingface-api-key",
  "venice": "venice-api-key",
  "litellm": "litellm-api-key",
  "cloudflare-ai-gateway": "cloudflare-ai-gateway-api-key",
  "custom": "custom-api-key",
};

function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) {}
  return {};
}

// 生成随机 token
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'oc_';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// 获取当前 token
function getGatewayToken() {
  const config = readConfig();
  return config?.gateway?.auth?.token || null;
}

function writeConfig(config) {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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
  ".json": "application/json",
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
  if (pathname === "/api/auth-groups" || pathname === "/api/providers") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(PROVIDERS));
    return;
  }

  // 获取服务商对应的默认认证方式
  if (pathname === "/api/provider-auth") {
    const provider = url.searchParams.get("provider");
    const auth = PROVIDER_AUTH[provider] || null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ auth, provider }));
    return;
  }

  // 获取模型列表
  if (pathname.startsWith("/api/models")) {
    const provider = url.searchParams.get("provider");
    let models = getModels();
    
    // 如果指定了 provider，过滤模型
    if (provider) {
      models = models.filter(m => m.provider.toLowerCase() === provider.toLowerCase());
    }
    
    // 如果过滤后没有模型，返回所有模型
    if (models.length === 0) {
      models = getModels();
    }
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(models));
    return;
}

  // 获取当前 gateway token
  if (pathname === "/api/token") {
    if (req.method === "GET") {
      const token = getGatewayToken();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token }));
      return;
    }
    // 生成新 token
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

  // 获取当前配置
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
          const config = JSON.parse(body);
          writeConfig(config);
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

  // 静态文件服务
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
