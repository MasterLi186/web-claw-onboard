const http = require("http");
const { execSync, spawn } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } = require("fs");
const { join, dirname } = require("path");

const PORT = 18080;
const CONFIG_PATH = "/root/.openclaw/openclaw.json";
const LOG_FILE = "/tmp/web-onboard.log";

function log(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  console.log(msg);
}

// 服务商列表
const PROVIDERS = [
  { value: "openai", label: "OpenAI", hint: "Codex OAuth + API key", apiKeyParam: "--openai-api-key" },
  { value: "anthropic", label: "Anthropic", hint: "setup-token + API key", apiKeyParam: "--anthropic-api-key" },
  { value: "chutes", label: "Chutes", hint: "OAuth", apiKeyParam: "--auth-choice chutes" },
  { value: "vllm", label: "vLLM", hint: "Local/self-hosted OpenAI-compatible", apiKeyParam: "--auth-choice vllm" },
  { value: "minimax", label: "MiniMax", hint: "M2.5 (recommended)", apiKeyParam: "--minimax-api-key" },
  { value: "moonshot", label: "Moonshot AI (Kimi K2.5)", hint: "Kimi K2.5 + Kimi Coding", apiKeyParam: "--moonshot-api-key" },
  { value: "google", label: "Google", hint: "Gemini API key + OAuth", apiKeyParam: "--gemini-api-key" },
  { value: "xai", label: "xAI (Grok)", hint: "API key", apiKeyParam: "--xai-api-key" },
  { value: "mistral", label: "Mistral AI", hint: "API key", apiKeyParam: "--mistral-api-key" },
  { value: "volcengine", label: "Volcano Engine", hint: "API key", apiKeyParam: "--volcengine-api-key" },
  { value: "byteplus", label: "BytePlus", hint: "API key", apiKeyParam: "--byteplus-api-key" },
  { value: "openrouter", label: "OpenRouter", hint: "API key", apiKeyParam: "--openrouter-api-key" },
  { value: "kilocode", label: "Kilo Gateway", hint: "API key", apiKeyParam: "--kilocode-api-key" },
  { value: "qwen", label: "Qwen", hint: "OAuth", apiKeyParam: "--auth-choice qwen" },
  { value: "zai", label: "Z.AI", hint: "GLM Coding Plan / Global / CN", apiKeyParam: "--zai-api-key" },
  { value: "qianfan", label: "Qianfan", hint: "API key", apiKeyParam: "--qianfan-api-key" },
  { value: "copilot", label: "Copilot", hint: "GitHub + local proxy", apiKeyParam: "--auth-choice github-copilot" },
  { value: "ai-gateway", label: "Vercel AI Gateway", hint: "API key", apiKeyParam: "--ai-gateway-api-key" },
  { value: "opencode-zen", label: "OpenCode Zen", hint: "API key", apiKeyParam: "--opencode-zen-api-key" },
  { value: "xiaomi", label: "Xiaomi", hint: "API key", apiKeyParam: "--xiaomi-api-key" },
  { value: "synthetic", label: "Synthetic", hint: "Anthropic-compatible", apiKeyParam: "--synthetic-api-key" },
  { value: "together", label: "Together AI", hint: "API key", apiKeyParam: "--together-api-key" },
  { value: "huggingface", label: "Hugging Face", hint: "HF token", apiKeyParam: "--huggingface-api-key" },
  { value: "venice", label: "Venice AI", hint: "Privacy-focused", apiKeyParam: "--venice-api-key" },
  { value: "litellm", label: "LiteLLM", hint: "Unified LLM gateway", apiKeyParam: "--litellm-api-key" },
  { value: "cloudflare-ai-gateway", label: "Cloudflare AI Gateway", hint: "Account ID + API key", apiKeyParam: "--cloudflare-ai-gateway-api-key" },
  { value: "custom", label: "Custom Provider", hint: "OpenAI or Anthropic compatible", apiKeyParam: "--custom-api-key" }
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

function writeAuthProfile(provider, apiKey) {
  const authPath = "/root/.openclaw/agents/main/agent/auth-profiles.json";
  let authData = { version: 1, profiles: {} };
  
  try {
    if (existsSync(authPath)) {
      authData = JSON.parse(readFileSync(authPath, "utf-8"));
    }
  } catch (e) {}
  
  authData.profiles[`${provider}:default`] = {
    type: "api_key",
    provider: provider,
    key: apiKey
  };
  
  const dir = dirname(authPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(authPath, JSON.stringify(authData, null, 2));
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

// 执行 openclaw onboard 命令
function runOnboard(config) {
  return new Promise((resolve, reject) => {
    const args = [
      "onboard",
      "--non-interactive",
      "--accept-risk",
      "--flow", "quickstart",
      "--skip-channels",
      "--skip-search",
      "--skip-skills",
      "--skip-ui",
      "--skip-health",
      "--skip-daemon",
      "--secret-input-mode", "plaintext"
    ];

    // 添加 API Key
    const provider = PROVIDERS.find(p => p.value === config.provider);
    if (provider && config.apiKey) {
      // 使用 apiKey 模式
      args.push("--auth-choice", "apiKey");
      args.push(provider.apiKeyParam, config.apiKey);
    }

    // 添加模型
    if (config.model) {
      args.push("--model", config.model);
    }

    // Gateway 配置
    if (config.gatewayPort) {
      args.push("--gateway-port", String(config.gatewayPort));
    }
    if (config.gatewayBind) {
      args.push("--gateway-bind", config.gatewayBind);
    }
    if (config.gatewayAuth) {
      args.push("--gateway-auth", config.gatewayAuth);
    }
    if (config.gatewayToken) {
      args.push("--gateway-token", config.gatewayToken);
    }

    console.log("Running openclaw onboard with args:", args.join(" "));

    const child = spawn("openclaw", args, {
      cwd: "/root",
      env: { ...process.env, HOME: "/root" }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      console.log("onboard exit code:", code);
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(`onboard failed: ${stderr || stdout}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
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
  
  log(`REQUEST: ${req.method} ${pathname}`);

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
      models = models.filter(m => m.provider.toLowerCase() === provider.toLowerCase() || 
                                    m.provider.toLowerCase().startsWith(provider.toLowerCase() + '-'));
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

  if (pathname === "/api/onboard") {
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", async () => {
        try {
          const config = JSON.parse(body);
          log(`ONBOARD CONFIG: ${JSON.stringify(config)}`);
          
          const fullConfig = {
            agents: {
              defaults: {
                model: { primary: config.model }
              }
            },
            gateway: {
              mode: 'local',
              bind: config.gatewayBind || 'lan',
              customBindHost: '0.0.0.0',
              port: config.gatewayPort || 18789,
              controlUi: {
                enabled: true,
                allowedOrigins: ['*'],
                allowInsecureAuth: true,
                dangerouslyDisableDeviceAuth: true
              },
              auth: {
                mode: config.gatewayAuth || 'token',
                token: config.gatewayToken || undefined
              }
            }
          };
          
          writeConfig(fullConfig);
          log(`WROTE config to ${CONFIG_PATH}`);
          
          if (config.provider && config.apiKey) {
            log(`WRITING auth profile: provider=${config.provider}, apiKey=${config.apiKey.substring(0, 10)}...`);
            writeAuthProfile(config.provider, config.apiKey);
            log(`WROTE auth profile`);
          }
          
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

  if (pathname === "/api/restart") {
    if (req.method === "POST") {
      const { execSync } = require("child_process");
      try {
        log(`RESTART: killing existing openclaw processes`);
        try { execSync("pkill -9 -f openclaw", { cwd: "/root" }); } catch(e) {}
        try { execSync("sleep 1", { cwd: "/root" }); } catch(e) {}
        log(`RESTART: starting via supervisor`);
        execSync("supervisorctl start openclaw", { cwd: "/root" });
        log(`RESTART: done`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        log(`RESTART ERROR: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
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
  const fullPath = join("/data", filePath);

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
