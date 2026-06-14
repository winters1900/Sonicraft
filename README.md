# Sonicraft

纯语音控制的 Canvas 绘图工具。目标：首次授权麦克风后，用户通过语音完成绘图、编辑变换、多画布、背景、撤销、保存与帮助开关。

## 演示视频

- B 站：<https://www.bilibili.com/video/BV1wzJK6zEhS/>
- 备用（南大网盘）：<https://box.nju.edu.cn/f/f2dd1295f0994e45aac4/>

## 当前架构

- **语音输入**：浏览器原生 Web Speech 持续聆听 + 实时字幕；先拦截「停止聆听 / 打开帮助 / 切换画布」等元控制口令。
- **指令理解**：本地规则解析（RuleParser）几何、布局、样式、变换、撤销、多画布、背景等高频中文命令，毫秒级且离线；未知但有绘图意图的对象转为 `imagine` 交给 AI 文生图。
- **任意物体绘图**：后端代理 Hugging Face 文生图，默认 `black-forest-labs/FLUX.1-schnell`，生成图片落到画布。
- **前景抠图**：文生图的前景物体在浏览器内用 RMBG-1.4（`@huggingface/transformers`）真抠图去背景，自然合成到画布背景上；模型与 ONNX runtime 均本地加载、不联网。
- **画布**：多画布（新建/切换并保留各画布内容）；背景可设纯色或 AI 文生图铺满整张画布。

## 快速启动

```bash
npm run install:all
copy backend\.env.example backend\.env
# 在 backend\.env 写入新的 HF_TOKEN（不要使用已泄露 token）
npm run dev
```

前端默认 Vite 地址通常是 `http://localhost:5173`，后端默认 `http://localhost:8787`。

> **前景抠图模型**不随仓库分发。需要「文生图自动去背景」功能时，先下载 RMBG 模型与 ONNX wasm 到 `frontend/public/`（约 70MB，需能访问 Hugging Face，国内可经代理）：
>
> ```bash
> cd backend && npm run fetch-models
> ```
>
> 未下载时绘图与文生图仍可用，只是前景不抠背景（直接带原图背景落到画布）。

## 环境变量

```env
HF_TOKEN=
HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
IMAGINE_TIMEOUT_MS=60000
CORS_ORIGINS=
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

`HF_TOKEN` 只在后端读取。未配置时几何绘图仍可用，但“画熊猫/芒果”等任意物体文生图不可用。

## 示例口令

| 类型 | 示例 |
| --- | --- |
| 几何绘图 | 画一个红色的圆 / 画三个蓝色方块排成一行 / 在左上角画大三角形 |
| 任意物体 | 画一只熊猫 / 画一个芒果 / 画一辆红色小汽车 |
| 组合绘图 | 画一个笑脸 / 画一座房子 / 画一棵树 / 画一只小猫 |
| 编辑变换 | 把它变成绿色 / 放大一点 / 把它移到左上角 / 向右移动100像素 / 画一个向上的箭头 / 旋转45度 |
| 画布与背景 | 新建画布 / 切换到第二张画布 / 下一张画布 / 把背景改成蓝色 / 把背景改成山林 / 去掉背景 |
| 管理 | 撤销 / 重做 / 清空画布 / 保存图片 |
| 应用控制 | 开始聆听 / 停止聆听 / 打开帮助 / 关闭帮助 |

## 测试

```bash
npm test
npm run build
npm run lint
npm audit
```

## 目录

```text
frontend/src/
  components/   UI 面板、帮助
  controller/   文本/语音命令执行闭环
  engine/       Canvas 图元、渲染、多画布、背景、撤销
  executor/     DrawCommand 执行、预设组合、HF 文生图客户端、浏览器内 RMBG 抠图
  parser/       中文规则解析与黄金集
  voice/        Web Speech ASR、语音元控制口令
backend/
  scripts/      RMBG 抠图模型/wasm 下载脚本（fetch-models）
  src/routes/   Hugging Face 文生图代理
  src/security.ts  CORS 与限流
shared/         命令 DSL、颜色、中文数字
```
