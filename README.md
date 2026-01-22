# 🀄 麻将在线 - Mahjong Online

## 概述 / Overview

麻将在线是一个基于 Web 的多人在线麻将游戏。支持中国麻将和日本麻将规则，提供用户注册登录、游客模式、房间创建、实时对战等功能。

Mahjong Online is a web-based multiplayer mahjong game. It supports Chinese and Japanese mahjong rules, with features including user registration/login, guest mode, room creation, and real-time gameplay.

## ✨ 功能特性 / Features

- 🎮 **多人实时对战** - 支持 4 人同时在线对战
- 🎯 **多种规则** - 支持中国麻将和日本麻将规则
- 👤 **用户系统** - 注册登录、游客模式
- 🏠 **房间系统** - 创建房间、加入房间、密码房间
- 📊 **排行榜** - 玩家积分排名
- 🔄 **回放系统** - 游戏回放功能
- 💬 **房间聊天** - 实时聊天功能

## 📁 项目结构 / Project Structure

```
mahjong-online
├── server/                  # 服务端
│   ├── index.js            # 服务器入口
│   ├── auth/               # 认证模块
│   ├── database/           # 数据库管理
│   │   └── Database.js     # SQLite 数据库操作
│   ├── game/               # 游戏逻辑
│   │   ├── GameManager.js  # 游戏管理器
│   │   ├── MahjongGame.js  # 麻将游戏核心
│   │   ├── Tile.js         # 麻将牌
│   │   ├── TileWall.js     # 牌墙
│   │   ├── Hand.js         # 手牌
│   │   ├── WinningChecker.js # 胡牌判断
│   │   └── RuleSets.js     # 规则集
│   ├── lobby/              # 大厅模块
│   │   ├── LobbyManager.js # 大厅管理器
│   │   └── RoomManager.js  # 房间管理器
│   └── replay/             # 回放模块
│       └── ReplayManager.js
├── client/                  # 客户端
│   ├── index.html          # 主页面
│   ├── css/                # 样式文件
│   │   ├── style.css       # 主样式
│   │   ├── game.css        # 游戏样式
│   │   └── tiles.css       # 麻将牌样式
│   └── js/                 # JavaScript 文件
│       ├── app.js          # 应用入口
│       ├── auth.js         # 认证模块
│       ├── lobby.js        # 大厅模块
│       ├── room.js         # 房间模块
│       ├── game.js         # 游戏模块
│       ├── socket-handler.js # Socket 处理
│       ├── tile-renderer.js  # 麻将牌渲染
│       ├── replay.js       # 回放模块
│       └── utils.js        # 工具函数
├── data/                    # 数据存储目录
├── docker/                  # Docker 配置
├── docker-compose.yml       # Docker Compose 配置
├── Dockerfile              # Dockerfile
└── package.json            # 项目配置
```

## 🚀 快速开始 / Getting Started

### 环境要求 / Prerequisites

- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装 / Installation

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/mahjong-online.git
   cd mahjong-online
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

### 运行 / Running

**开发模式：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

服务器将在 http://localhost:3000 启动。

### Docker 部署 / Docker Deployment

```bash
docker-compose up -d
```

## 🎮 使用说明 / Usage

1. 打开浏览器访问 `http://localhost:3000`
2. 选择登录方式：
   - **注册/登录** - 创建账号保存游戏记录
   - **游客模式** - 快速体验，不保存记录
3. 进入大厅后可以：
   - 创建新房间
   - 加入已有房间
   - 快速匹配
4. 在房间中等待 4 人后开始游戏

## 🛠️ 技术栈 / Tech Stack

- **后端**: Node.js, Express, Socket.IO
- **前端**: 原生 HTML/CSS/JavaScript
- **数据库**: SQLite (sql.js)
- **认证**: bcryptjs, JWT
- **部署**: Docker, Nginx

## 📝 API 接口 / API Endpoints

### HTTP API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| GET | `/api/rankings` | 获取排行榜 |

### Socket 事件

| 事件 | 方向 | 描述 |
|------|------|------|
| `guestLogin` | Client → Server | 游客登录 |
| `authenticated` | Server → Client | 认证结果 |
| `getLobbyInfo` | Client → Server | 获取大厅信息 |
| `getRooms` | Client → Server | 获取房间列表 |
| `createRoom` | Client → Server | 创建房间 |
| `joinRoom` | Client → Server | 加入房间 |
| `leaveRoom` | Client → Server | 离开房间 |
| `playerReady` | Client → Server | 玩家准备 |
| `startGame` | Client → Server | 开始游戏 |

## 🤝 贡献 / Contributing

欢迎提交 Issue 和 Pull Request！

## 📄 许可证 / License

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。