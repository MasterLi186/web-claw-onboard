# 部署环境记忆

## 宿主机 (Android 设备) ⭐
- 登录: `adb -s AR80V12CS5B252600071 shell`
- 设备ID: AR80V12CS5B252600071

## 容器 (目标部署环境)
- 登录: `sshpass -p root ssh root@192.168.110.23 -p 2222`
- 容器名称: openclaw-dev
- 镜像: `openclaw-dev:v21` (版本会迭代)
- 启动命令: `/usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf`

### 端口映射 (当前配置)
| 宿主机端口 | 容器端口 | 用途 |
|-----------|---------|------|
| 8080 | 8080 | Web 应用 |
| 18080 | 18080 | Web Onboard 配置向导 |
| 18789 | 18789 | Gateway |
| 2222 | 22 | SSH |

### Supervisor 配置
- Web 服务配置: `/etc/supervisor/conf.d/web-onboard.conf`
- 日志: `/var/log/web-onboard.log`

## 源码
- 本地: `/home/lfl/code/web-claw-onboard`
- 容器内: `/opt/web-onboard`

> 注意：`start-openclaw.sh` 属于 OpenClaw 项目本身，不在 Web 工程中。

---

## 创建容器方案

```bash
# 1. 停止并删除旧容器
docker stop openclaw-dev && docker rm openclaw-dev

# 2. 使用最新镜像创建新容器
docker run -d \
  --name openclaw-dev \
  -p 8080:8080 \
  -p 18080:18080 \
  -p 18789:18789 \
  -p 2222:22 \
  openclaw-dev:v21

# 3. 传输源码到容器 (首次部署)
sshpass -p root scp -o StrictHostKeyChecking=no -P 2222 /tmp/web-claw-onboard.tar.gz root@192.168.110.23:/tmp/
docker exec openclaw-dev tar -xzf /tmp/web-claw-onboard.tar.gz -C /opt/web-onboard/
```

---

## Supervisor 配置 (web-onboard.conf)

首次部署后，在容器内创建：

```bash
docker exec openclaw-dev sh -c 'printf "[program:web-onboard]
command=sh -c \"cd /opt/web-onboard && node server.js\"
autostart=true
autorestart=true
user=root
stdout_logfile=/var/log/web-onboard.log
stderr_logfile=/var/log/web-onboard-error.log
directory=/opt/web-onboard
" > /etc/supervisor/conf.d/web-onboard.conf'

# 重载配置
docker exec openclaw-dev supervisorctl update
```

## 启动脚本 (start-openclaw.sh)

Web 向导保存配置后会自动重启 OpenClaw，启动脚本会从配置文件读取参数：

```bash
# 默认值
PORT=18789
BIND="lan"
TOKEN=""

# 从 JSON 读取
# gateway.port
# gateway.bind
# gateway.auth.token
```

## OpenClaw Supervisor 配置

```bash
docker exec openclaw-dev sh -c 'printf "[program:openclaw]
command=/opt/web-onboard/start-openclaw.sh
autostart=true
autorestart=true
user=root
stdout_logfile=/var/log/openclaw.log
stderr_logfile=/var/log/openclaw-error.log
directory=/root
" > /etc/supervisor/conf.d/openclaw.conf'

docker exec openclaw-dev supervisorctl update
```

---

## 开发调试流程 (推荐 SSH 方式)

```bash
# 方式1: 直接 SCP 推送 (推荐)
sshpass -p root scp -o StrictHostKeyChecking=no -P 2222 \
  /home/lfl/code/web-claw-onboard/server.js \
  /home/lfl/code/web-claw-onboard/index.html \
  root@192.168.110.23:/opt/web-onboard/

# 2. 重启 web 服务
sshpass -p root ssh -o StrictHostKeyChecking=no -p 2222 root@192.168.110.23 \
  "pkill -9 -f 'node.*server.js' || true; sleep 1; supervisorctl start web-onboard"

# 3. 测试
curl http://192.168.110.23:18080/
```

---

## 方式2: ADB + Docker exec

```bash
# 1. 本地修改代码后打包
cd /home/lfl/code/web-claw-onboard
tar --exclude='.git' -czf /tmp/web-claw-onboard.tar.gz .

# 2. 传输到容器
adb push /tmp/web-claw-onboard.tar.gz /tmp/

# 3. 替换容器内源码
adb shell "docker exec openclaw-dev tar -xzf /tmp/web-claw-onboard.tar.gz -C /opt/web-onboard/"

# 4. 重启 web 服务
adb shell "docker exec openclaw-dev supervisorctl restart web-onboard"

# 5. 测试
curl http://192.168.110.23:18080/
```
