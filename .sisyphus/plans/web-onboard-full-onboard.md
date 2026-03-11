# 实现 Web 版 OpenClaw Onboard 引导界面

## 目标

将 `openclaw onboard` 命令的交互式引导过程，移植到 Web 界面上，让用户可以通过浏览器完成 OpenClaw 的初始配置。

## 现状分析

### 当前 web 应用功能
- Step 1: 选择 AI 服务商 + API Key + 模型
- Step 2: Gateway 配置 (端口、绑定、认证、Token)
- 提交方式: 直接写入 JSON 配置文件

### openclaw onboard 命令参数
支持非交互模式 (`--non-interactive`)，关键参数：
- `--flow quickstart` - 快速启动模式
- `--skip-channels` - 跳过频道设置
- `--skip-search` - 跳过搜索设置
- `--skip-skills` - 跳过技能设置
- `--skip-ui` - 跳过 UI 提示
- `--skip-health` - 跳过健康检查
- `--skip-daemon` - 跳过守护进程安装
- `--accept-risk` - 接受安全警告
- `--auth-choice <provider>` - 认证方式
- `--<provider>-api-key <key>` - API Key
- `--model <model>` - 模型选择
- `--gateway-port <port>` - 网关端口
- `--gateway-bind <mode>` - 绑定模式
- `--gateway-auth <mode>` - 认证模式
- `--gateway-token <token>` - 网关 Token

## 实现计划

### Task 1: 扩展 server.js - 添加 /api/onboard 接口

- [ ] 1.1 添加 `runOnboard()` 函数，调用 `openclaw onboard --non-interactive` 命令
- [ ] 1.2 添加 `/api/onboard` POST 接口，接收配置并执行 onboard 命令
- [ ] 1.3 修复静态文件路径 (从 `/app/web-onboard/public` 改为 `/data`)

### Task 2: 扩展 index.html - 添加完整引导 UI

- [ ] 2.1 Step 0: 安全警告确认界面
- [ ] 2.2 Step 1: 选择 AI 服务商 (Provider)
- [ ] 2.3 Step 2: 输入 API Key
- [ ] 2.4 Step 3: 选择模型
- [ ] 2.5 Step 4: Gateway 配置 (端口、绑定、认证、Token)
- [ ] 2.6 Step 5: 确认页面，显示所有配置摘要
- [ ] 2.7 Step 6: 执行 onboard，显示进度和结果

### Task 3: 部署测试

- [ ] 3.1 打包最新代码
- [ ] 3.2 传输到容器
- [ ] 3.3 重启 web 服务
- [ ] 3.4 测试完整引导流程

## 技术要点

1. **配置传递**: 前端收集所有配置 → 发送 JSON 到后端 → 后端调用 `openclaw onboard` 命令
2. **命令执行**: 使用 Node.js `spawn` 异步执行命令，实时输出日志
3. **结果反馈**: 执行完成后返回结果给前端，显示成功/失败信息

## 预期结果

用户通过 Web 界面完成 6 步引导设置后，OpenClaw 配置自动完成，并显示 Control UI 访问地址。
