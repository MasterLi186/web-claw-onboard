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
  { value: "minimax-api", label: "MiniMax M2.5", hint: "Global endpoint (api.minimax.io)", apiKeyParam: "--minimax-api-key" },
  { value: "minimax-api-key-cn", label: "MiniMax M2.5 (CN)", hint: "China endpoint (api.minimaxi.com)", apiKeyParam: "--minimax-api-key" },
  { value: "minimax-api-lightning", label: "MiniMax M2.5 Highspeed", hint: "Official fast tier", apiKeyParam: "--minimax-api-key" },
  { value: "moonshot", label: "Moonshot AI (Kimi K2.5)", hint: "Kimi K2.5 + Kimi Coding", apiKeyParam: "--moonshot-api-key" },
  { value: "google", label: "Google", hint: "Gemini API key + OAuth", apiKeyParam: "--gemini-api-key" },
  { value: "xai", label: "xAI (Grok)", hint: "API key", apiKeyParam: "--xai-api-key" },
  { value: "mistral", label: "Mistral AI", hint: "API key", apiKeyParam: "--mistral-api-key" },
  { value: "volcengine", label: "Volcano Engine", hint: "API key", apiKeyParam: "--volcengine-api-key" },
  { value: "byteplus", label: "BytePlus", hint: "API key", apiKeyParam: "--byteplus-api-key" },
  { value: "openrouter", label: "OpenRouter", hint: "API key", apiKeyParam: "--openrouter-api-key" },
  { value: "kilocode", label: "Kilo Gateway", hint: "API key", apiKeyParam: "--kilocode-api-key" },
  { value: "qwen", label: "Qwen", hint: "OAuth", apiKeyParam: "--auth-choice qwen" },
  { value: "zai-coding-global", label: "Z.AI Coding-Plan-Global", hint: "GLM Coding Plan Global (api.z.ai)", apiKeyParam: "--zai-api-key" },
  { value: "zai-coding-cn", label: "Z.AI Coding-Plan-CN", hint: "GLM Coding Plan CN (open.bigmodel.cn)", apiKeyParam: "--zai-api-key" },
  { value: "zai-global", label: "Z.AI Global", hint: "Z.AI Global (api.z.ai)", apiKeyParam: "--zai-api-key" },
  { value: "zai-cn", label: "Z.AI CN", hint: "Z.AI CN (open.bigmodel.cn)", apiKeyParam: "--zai-api-key" },
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
  { value: "siliconflow", label: "硅基流动 (SiliconFlow)", hint: "100+ 模型, Base: https://api.siliconflow.cn/v1", apiKeyParam: "--custom-api-key" },
  { value: "custom", label: "Custom Provider", hint: "OpenAI or Anthropic compatible", apiKeyParam: "--custom-api-key" }
];

// SiliconFlow 模型列表 (完整)
const SILICONFLOW_MODELS = [
  { id: "Qwen/Qwen2.5-7B-Instruct", name: "Qwen2.5-7B-Instruct", ctx: "32K" },
  { id: "Qwen/Qwen2.5-14B-Instruct", name: "Qwen2.5-14B-Instruct", ctx: "32K" },
  { id: "Qwen/Qwen2.5-32B-Instruct", name: "Qwen2.5-32B-Instruct", ctx: "32K" },
  { id: "Qwen/Qwen2.5-Coder-7B-Instruct", name: "Qwen2.5-Coder-7B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2.5-Coder-14B-Instruct", name: "Qwen2.5-Coder-14B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen2.5-Coder-32B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2.5-VL-7B-Instruct", name: "Qwen2.5-VL-7B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2.5-VL-14B-Instruct", name: "Qwen2.5-VL-14B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2-Math-7B-Instruct", name: "Qwen2-Math-7B-Instruct", ctx: "8K" },
  { id: "Qwen/Qwen2-Math-72B-Instruct", name: "Qwen2-Math-72B-Instruct", ctx: "32K" },
  { id: "THUDG/glm-4-9b-chat", name: "GLM-4-9B-Chat", ctx: "128K" },
  { id: "THUDG/glm-4-9b-chat-1m", name: "GLM-4-9B-Chat-1M", ctx: "1M" },
  { id: "THUDG/glm-4-32b", name: "GLM-4-32B", ctx: "128K" },
  { id: "THUDG/glm-4v-9b", name: "GLM-4V-9B", ctx: "8K" },
  { id: "THUDG/glm-edge-1.5b-chat", name: "GLM-Edge-1.5B-Chat", ctx: "8K" },
  { id: "THUDG/glm-edge-5b-chat", name: "GLM-Edge-5B-Chat", ctx: "8K" },
  { id: "deepseek-ai/DeepSeek-Coder-V2", name: "DeepSeek-Coder-V2", ctx: "16K" },
  { id: "deepseek-ai/DeepSeek-Coder-V2-Lite", name: "DeepSeek-Coder-V2-Lite", ctx: "16K" },
  { id: "deepseek-ai/DeepSeek-V2", name: "DeepSeek-V2", ctx: "32K" },
  { id: "deepseek-ai/DeepSeek-V2-Chat", name: "DeepSeek-V2-Chat", ctx: "32K" },
  { id: "deepseek-ai/DeepSeek-VL2", name: "DeepSeek-VL2", ctx: "4K" },
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Llama-3-8B-Instruct", ctx: "8K" },
  { id: "meta-llama/Meta-Llama-3-70B-Instruct", name: "Llama-3-70B-Instruct", ctx: "8K" },
  { id: "meta-llama/Meta-Llama-3.1-8B-Instruct", name: "Llama-3.1-8B-Instruct", ctx: "128K" },
  { id: "meta-llama/Meta-Llama-3.1-70B-Instruct", name: "Llama-3.1-70B-Instruct", ctx: "128K" },
  { id: "meta-llama/Meta-Llama-3.1-405B-Instruct", name: "Llama-3.1-405B-Instruct", ctx: "128K" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral-7B-Instruct-v0.3", ctx: "32K" },
  { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", name: "Mixtral-8x7B-Instruct", ctx: "32K" },
  { id: "mistralai/Mixtral-8x22B-Instruct-v0.1", name: "Mixtral-8x22B-Instruct", ctx: "64K" },
  { id: "anthropic/claude-3-opus-20240229", name: "Claude-3-Opus", ctx: "200K" },
  { id: "anthropic/claude-3-sonnet-20240229", name: "Claude-3-Sonnet", ctx: "200K" },
  { id: "anthropic/claude-3-haiku-20240307", name: "Claude-3-Haiku", ctx: "200K" },
  { id: "anthropic/claude-3-5-sonnet-20241022", name: "Claude-3.5-Sonnet", ctx: "200K" },
  { id: "openai/gpt-4o", name: "GPT-4o", ctx: "128K" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o-mini", ctx: "128K" },
  { id: "openai/gpt-4-turbo", name: "GPT-4-Turbo", ctx: "128K" },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5-Turbo", ctx: "16K" },
  { id: "google/gemini-1.5-pro", name: "Gemini-1.5-Pro", ctx: "1M" },
  { id: "google/gemini-1.5-flash", name: "Gemini-1.5-Flash", ctx: "1M" },
  { id: "google/gemini-1.5-flash-8b", name: "Gemini-1.5-Flash-8B", ctx: "1M" },
  { id: "xai/grok-vision-beta", name: "Grok-Vision-Beta", ctx: "8K" },
  { id: "xai/grok-2", name: "Grok-2", ctx: "131K" },
  { id: "xai/grok-2-1212", name: "Grok-2-1212", ctx: "131K" },
  { id: "azure/gpt-4o", name: "Azure GPT-4o", ctx: "128K" },
  { id: "azure/gpt-4o-mini", name: "Azure GPT-4o-mini", ctx: "128K" },
  { id: "azure/gpt-4-turbo", name: "Azure GPT-4-Turbo", ctx: "128K" },
  { id: "moonshotai/moonshot-v1-8k", name: "Moonshot-v1-8K", ctx: "8K" },
  { id: "moonshotai/moonshot-v1-32k", name: "Moonshot-v1-32K", ctx: "32K" },
  { id: "moonshotai/moonshot-v1-128k", name: "Moonshot-v1-128K", ctx: "128K" },
  { id: "stepfun-ai/Step-1V-1.6", name: "Step-1V-1.6", ctx: "8K" },
  { id: "stepfun-ai/Step-1.5", name: "Step-1.5", ctx: "4K" },
  { id: "01-ai/yi-1.5-6b", name: "Yi-1.5-6B", ctx: "4K" },
  { id: "01-ai/yi-1.5-9b", name: "Yi-1.5-9B", ctx: "4K" },
  { id: "01-ai/yi-1.5-34b", name: "Yi-1.5-34B", ctx: "4K" },
  { id: "01-ai/yi-vl-plus", name: "Yi-VL-Plus", ctx: "4K" },
  { id: "baichuan-inc/Baichuan2-Turbo", name: "Baichuan2-Turbo", ctx: "32K" },
  { id: "baichuan-inc/Baichuan2-53B", name: "Baichuan2-53B", ctx: "32K" },
  { id: "zhipuai/chatglm3-6b", name: "ChatGLM3-6B", ctx: "8K" },
  { id: "zhipuai/chatglm4-9b", name: "ChatGLM4-9B", ctx: "128K" },
  { id: "zhipuai/chatglm4v-6b", name: "ChatGLM4V-6B", ctx: "8K" },
  { id: "microsoft/Phi-3-mini-4k-instruct", name: "Phi-3-mini-4K", ctx: "4K" },
  { id: "microsoft/Phi-3-mini-128k-instruct", name: "Phi-3-mini-128K", ctx: "128K" },
  { id: "microsoft/Phi-3.5-mini-instruct", name: "Phi-3.5-mini", ctx: "4K" },
  { id: "microsoft/Phi-3.5-vision-instruct", name: "Phi-3.5-Vision", ctx: "4K" },
  { id: "internlm/internlm2-5-7b", name: "InternLM2.5-7B", ctx: "32K" },
  { id: "internlm/internlm2-5-20b", name: "InternLM2.5-20B", ctx: "32K" },
  { id: "internlm/internlm2-chat-7b", name: "InternLM2-Chat-7B", ctx: "32K" },
  { id: "01-ai/yi-coder-9b", name: "Yi-Coder-9B", ctx: "4K" },
  { id: "01-ai/yi-coder-34b", name: "Yi-Coder-34B", ctx: "4K" },
  { id: "Salesforce/codegen-16b", name: "CodeGen-16B", ctx: "4K" },
  { id: "bigcode/starcoder2-15b", name: "StarCoder2-15B", ctx: "16K" },
  { id: "codellama/CodeLlama-7b-Instruct", name: "CodeLlama-7B", ctx: "16K" },
  { id: "codellama/CodeLlama-13b-Instruct", name: "CodeLlama-13B", ctx: "16K" },
  { id: "codellama/CodeLlama-34b-Instruct", name: "CodeLlama-34B", ctx: "16K" },
  { id: "WizardLM/WizardCoder-Python-34B", name: "WizardCoder-Python-34B", ctx: "16K" },
  { id: "large-language-models/PolyCoder-2.7B", name: "PolyCoder-2.7B", ctx: "2K" },
  { id: "google/falken-12b", name: "Falken-12B", ctx: "8K" },
  { id: "google/gemma-2-27b-it", name: "Gemma-2-27B-It", ctx: "8K" },
  { id: "google/gemma-2-9b-it", name: "Gemma-2-9B-It", ctx: "8K" },
  { id: "BAAI/bge-m3", name: "BGE-M3", ctx: "8K" },
  { id: "BAAI/bge-large-zh-v1.5", name: "BGE-Large-ZH-v1.5", ctx: "512" },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "Nemotron-70B", ctx: "128K" },
  { id: "AI-ModelScope/flux1-schnell", name: "Flux1-Schnell", ctx: "N/A" },
  { id: "stabilityai/stable-diffusion-3-medium", name: "SD3-Medium", ctx: "N/A" },
  { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1-schnell", ctx: "N/A" },
  { id: "bytedance/sdxl-turbo", name: "SDXL-Turbo", ctx: "N/A" },
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

function writeModelsConfig(provider, apiKey, modelId) {
  const modelsPath = "/root/.openclaw/agents/main/agent/models.json";
  let modelsData = { providers: {} };
  
  try {
    if (existsSync(modelsPath)) {
      modelsData = JSON.parse(readFileSync(modelsPath, "utf-8"));
    }
  } catch (e) {}
  
  if (!modelsData.providers) modelsData.providers = {};
  
  modelsData.providers[provider] = {
    baseUrl: "https://api.siliconflow.cn/v1",
    api: "openai-completions",
    apiKey: apiKey,
    models: [
      {
        id: modelId,
        name: modelId,
        input: ["text"],
        contextWindow: 128000,
        maxTokens: 4096
      }
    ]
  };
  
  const dir = dirname(modelsPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(modelsPath, JSON.stringify(modelsData, null, 2));
}

function writeAuthProfile(provider, apiKey) {
  const authPath = "/root/.openclaw/agents/main/agent/auth-profiles.json";
  let authData = { version: 1, profiles: {} };
  
  try {
    if (existsSync(authPath)) {
      authData = JSON.parse(readFileSync(authPath, "utf-8"));
    }
  } catch (e) {}
  
  let providerKey = provider;
  if (provider === 'minimax-api') providerKey = 'minimax';
  if (provider === 'minimax-api-key-cn') providerKey = 'minimax-cn';
  if (provider === 'minimax-api-lightning') providerKey = 'minimax';
  
  authData.profiles[`${providerKey}:default`] = {
    type: "api_key",
    provider: providerKey,
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
  if (pathname === "/api/models") {
    const provider = url.searchParams.get("provider");
    let models = getModels();
    if (provider) {
      let modelProvider = provider;
      if (provider === 'minimax-api') modelProvider = 'minimax';
      if (provider === 'minimax-api-key-cn') modelProvider = 'minimax-cn';
      if (provider === 'minimax-api-lightning') modelProvider = 'minimax';
      
      models = models.filter(m => m.provider.toLowerCase() === modelProvider.toLowerCase() || 
                                    m.provider.toLowerCase().startsWith(modelProvider.toLowerCase() + '-'));
    }
    if (models.length === 0) {
      models = getModels();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(models));
    return;
  }

  if (pathname === "/api/siliconflow-models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(SILICONFLOW_MODELS));
    return;
  }

  if (pathname === "/api/debug-log") {
    const msg = url.searchParams.get("msg") || "";
    const time = new Date().toISOString();
    appendFileSync("/tmp/web-onboard-debug.log", `[${time}] ${msg}\n`);
    res.writeHead(200);
    res.end("ok");
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
          
          let modelPrimary = config.model;
          if (config.provider === 'siliconflow' && config.model) {
            modelPrimary = 'siliconflow/' + config.model;
          }
          
          const fullConfig = {
            agents: {
              defaults: {
                model: { primary: modelPrimary }
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
          
          if (config.provider === 'siliconflow' && config.apiKey && config.model) {
            log(`WRITING siliconflow models config`);
            writeModelsConfig('siliconflow', config.apiKey, config.model);
            log(`WROTE siliconflow models config`);
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
  const fullPath = join("/opt/web-onboard", filePath);

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
