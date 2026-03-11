# OpenClaw Web Onboard

可视化 Web 配置向导，用于配置 OpenClaw Gateway。

## 快速开始

### 文件说明

- `server.js` - 后端服务
- `index.html` - 前端页面

### 启动服务

```bash
node server.js
```

访问 http://localhost:18080

## API

- `GET /api/providers` - 获取服务商列表
- `GET /api/models?provider=xxx` - 获取模型列表
- `GET /api/config` - 获取配置
- `POST /api/config` - 设置配置
- `GET /api/token` - 获取当前 Token
- `POST /api/token` - 生成新 Token
- `POST /api/onboard` - 保存配置并写入 auth-profiles.json
- `POST /api/restart` - 重启 OpenClaw 服务
