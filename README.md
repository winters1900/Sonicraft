# 🎙️ AI 语音绘图工具 (Voice Draw)

> 七牛云暑期比赛作品 · 纯语音控制的 Canvas 绘图工具——不用鼠标键盘，开口即画。

完整闭环：**语音输入 (七牛 ASR) → 指令理解 (本地规则 + 七牛 LLM 拆解) → Canvas 绘图执行 → 语音反馈 (七牛 TTS)**。

## 目录结构

```
qiniu/
├── frontend/        # React + TypeScript + Vite，画布引擎、语音控制、UI
├── backend/         # Node + Express，七牛 LLM/ASR/TTS 代理（隔离密钥）
├── shared/          # 前后端共享的 DrawCommand 指令类型 (DSL)
└── docs/            # 设计文档
```

## 快速开始

```bash
# 1. 安装依赖
npm run install:all

# 2. 配置七牛密钥（语音 / LLM 功能需要；纯规则解析无需密钥）
cp backend/.env.example backend/.env   # 然后填入 QINIU_API_KEY

# 3. 启动（同时拉起前后端）
npm run dev
# 前端 http://localhost:5173，后端 http://localhost:8787
```

> 未配置密钥时，应用仍可通过本地规则解析 + 手动文本输入演示绘图链路。

## 技术栈与依赖

| 部分 | 选型 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite 6、Vitest |
| 后端 | Node、Express、ws、dotenv |
| AI 能力 | 七牛云 AI 大模型推理（OpenAI 兼容）、七牛 ASR、七牛 TTS |

所有第三方依赖均在各自 `package.json` 中列明；语音识别/合成与大模型推理均调用七牛云官方服务。

## 开发进度

详见 [docs/DESIGN.md](docs/DESIGN.md)（指令能力清单 / 已实现 / 未完成原因）。

## Demo 视频

> 待补充（PR-10 提交时填入 bilibili / 云盘链接）。
