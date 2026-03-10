# OpenClaw Web Onboard

一个可视化的 Web 配置向导，用于替代 `openclaw onboard` 命令来配置 OpenClaw Gateway。

## 功能特性

- **可视化配置**：通过 Web 界面配置认证信息和 Gateway 设置
- **多服务商支持**：支持 27+ 个 LLM 服务商（OpenAI、Anthropic、MiniMax 等）
- **Token 自动管理**：首次自动生成 Token，后续自动读取
- **一键启动**：配置完成后自动重启 Gateway
- **Supervisor 集成**：通过 Supervisor 进程管理，支持自启

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    容器环境                          │
│  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Web 应用 (18080)│  │  OpenClaw Gateway      │ │
│  │  - server.js   │  │  (18789)                │ │
│  │  - index.html  │  │                         │ │
│  └────────┬────────┘  └────────────┬────────────┘ │
│           │                        │               │
│           ▼                        ▼               │
│  ┌─────────────────────────────────────────────┐  │
│  │         Supervisor 进程管理                   │  │
│  │  - web-onboard                             │  │
│  │  - openclaw (通过 start-openclaw.sh 启动)  │  │
│  │  - sshd                                    │  │
│  └─────────────────────────────────────────────┘  │
│                         │                          │
│                         ▼                          │
│  ┌─────────────────────────────────────────────┐  │
│  │         /root/.openclaw/openclaw.json       │  │
│  │         (唯一配置数据源)                      │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `server.js` | 后端服务，提供 API 接口 |
| `index-v2.html` | 前端页面，配置向导 UI |
| `start-openclaw.sh` | OpenClaw 启动脚本，读取 token 并传递 |

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/providers` | GET | 获取服务商列表 |
| `/api/models?provider=xxx` | GET | 获取指定服务商的模型列表 |
| `/api/config` | GET/POST | 读取/写入配置 |
| `/api/token` | GET | 获取当前 Gateway Token |
| `/api/token` | POST | 生成新 Token |

## 快速开始

### 1. 启动服务

容器已配置 Supervisor 自动启动：

```bash
# 启动容器
docker run -dit \
  -p 18080:18080 \
  -p 18789:18789 \
  -p 2222:22 \
  --name dev-container \
  dev-env:v8 /start.sh
```

### 2. 访问 Web 配置界面

```
http://<容器IP>:18080
```

### 3. 配置步骤

1. **认证配置**：选择服务商，输入 API Key，选择模型
2. **Gateway 配置**：设置端口、绑定模式、认证模式
3. **应用配置**：点击应用，Supervisor 自动重启 Gateway
4. **访问**：使用带 Token 的 URL 访问

## Token 管理

- **首次访问**：自动生成随机 Token 并填入输入框
- **后续访问**：自动读取已有 Token
- **URL 拼接**：访问链接自动拼接 `#token=xxx`

Token 优先级（从高到低）：
1. CLI 参数 `--token`
2. 环境变量 `OPENCLAW_GATEWAY_TOKEN`
3. 配置文件 `gateway.auth.token`

## 目录结构

```
/app/web-onboard/
├── server.js           # 后端服务
└── public/
    └── index.html     # 前端页面

/root/.openclaw/
└── openclaw.json      # 配置文件（数据源）

/start-openclaw.sh     # Gateway 启动脚本
```

## 常见问题

### Q: 选择服务商后提示"未找到模型"
A: 检查 `openclaw.json` 中是否有不完整的 `models.providers` 配置，删除后重试。

### Q: Gateway 启动失败
A: 检查 `/var/log/supervisor/openclaw.log` 日志，确保 `openclaw.json` 格式正确。

### Q: 如何查看服务状态
```bash
supervisorctl status
```

## 调试指南

### 进入容器

```bash
# 方式1：docker exec（推荐）
ssh li@li "docker exec -it dev-container bash"

# 方式2：SSH 登录
ssh -p 2222 root@li
# 密码: root
```

### 查看服务状态

```bash
# 查看所有服务
supervisorctl status

# 查看单个服务
supervisorctl status openclaw
supervisorctl status web-onboard
```

### 查看日志

```bash
# OpenClaw 日志
tail -f /var/log/supervisor/openclaw.log

# Web 应用日志
tail -f /var/log/supervisor/web-onboard.log

# SSH 日志
tail -f /var/log/supervisor/sshd.log
```

### 重启服务

```bash
# 重启 OpenClaw
supervisorctl restart openclaw

# 重启 Web 应用
supervisorctl restart web-onboard

# 重启所有服务
supervisorctl restart all
```

### 直接运行（调试模式）

```bash
# 进入容器
ssh li@li "docker exec -it dev-container bash"

# 前台运行 Web 应用（方便查看输出）
node /app/web-onboard/server.js

# 前台运行 OpenClaw
openclaw gateway
```

### 测试 API

```bash
# 获取服务商列表
curl http://localhost:18080/api/providers

# 获取当前配置
curl http://localhost:18080/api/config

# 获取当前 Token
curl http://localhost:18080/api/token

# 生成新 Token
curl -X POST http://localhost:18080/api/token

# 获取模型列表
curl "http://localhost:18080/api/models?provider=minimax"
```

---

## 部署指南

### 方式1：使用现有镜像

```bash
# 停止并删除旧容器
docker stop dev-container
docker rm dev-container

# 启动新容器
docker run -dit \
  -p 18080:18080 \
  -p 18789:18789 \
  -p 2222:22 \
  --name dev-container \
  dev-env:v8 /start.sh
```

### 方式2：本地开发部署

修改本地文件后，需要同步到容器：

```bash
# 同步后端代码
cat server-v3.js | ssh li@li 'docker exec -i dev-container sh -c "cat > /app/web-onboard/server.js"'

# 同步前端代码
cat index-v2.html | ssh li@li 'docker exec -i dev-container sh -c "cat > /app/web-onboard/public/index.html"'

# 重启 Web 应用
ssh li@li "docker exec dev-container supervisorctl restart web-onboard"
```

### 方式3：重新构建镜像

修改代码后，重新提交镜像：

```bash
# 提交当前容器为新镜像
docker commit dev-container dev-env:v9

# 停止旧容器
docker stop dev-container
docker rm dev-container

# 用新镜像启动
docker run -dit \
  -p 18080:18080 \
  -p 18789:18789 \
  -p 2222:22 \
  --name dev-container \
  dev-env:v9 /start.sh
```

### 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 18080 | Web 应用 | 配置向导界面 |
| 18789 | OpenClaw Gateway | Agent 控制界面 |
| 2222 | SSH | 容器 SSH 访问 |

### Supervisor 配置位置

```bash
# 配置文件目录
/etc/supervisor/conf.d/

# 各服务配置
/etc/supervisor/conf.d/web-onboard.conf
/etc/supervisor/conf.d/openclaw.conf
/etc/supervisor/conf.d/sshd.conf
```

## 技术栈

- **后端**：Node.js + 原生 HTTP
- **前端**：原生 HTML + CSS + JavaScript
- **进程管理**：Supervisor
- **容器**：Docker + Ubuntu 22.04

## License

MIT
