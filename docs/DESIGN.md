# Sonicraft 设计说明

## 目标

应用面向“不能使用鼠标或键盘”的绘图场景。除首次浏览器麦克风授权外，核心操作全部通过语音完成：聆听控制、绘图、编辑变换、多画布、背景、撤销、保存、帮助。

## 当前实现

```text
麦克风
  └─ WebSpeechEngine：浏览器原生持续聆听 -> 实时字幕 + 中文文本
文本
  ├─ matchVoiceControl：先拦截「停止聆听 / 打开帮助 / 关闭帮助」等元控制口令
  └─ RuleParser：中文规则 -> DrawCommand[]
        ├─ create/compose/move/scale/rotate/recolor/style/delete/undo/redo/export
        ├─ newPage/switchPage：多画布
        ├─ background：纯色 / AI 文生图背景
        └─ imagine：任意物体 prompt（规则未命中且有绘图意图时兜底）
执行
  ├─ CommandExecutor：几何与组合图形，事务执行、失败回滚
  ├─ imagineClient：POST /api/imagine -> 图片 dataURL
  ├─ matting：浏览器内 RMBG-1.4（transformers.js）抠前景背景 -> 透明 PNG
  └─ CanvasEngine：几何/image 图元渲染 + 多画布 + 背景 + 撤销历史
```

## 关键决策

- **语音单引擎（Web Speech）**：弃用浏览器内 Whisper 与七牛 ASR/LLM/TTS/Kodo。Whisper 首次加载模型慢、七牛 REST ASR 需对象存储中转，延迟与配置复杂度都不适合当前目标；Web Speech 持续聆听 + 实时字幕已能覆盖场景。
- **移除语音播报（TTS）**：执行结果只写入命令日志，不再用 `SpeechSynthesis` 播报，相应地也移除了抑制回声的 TTS gate。
- **几何与 AI 分工**：圆、方、移动、改色等结构化命令走本地规则，延迟低、离线、可编辑；“熊猫/芒果/汽车”等开放物体走 HF 文生图，作为 image 图元进入画布。
- **前景抠图本地化**：文生图自带背景，直接落到画布会有“贴纸感”且与画布背景冲突。改用浏览器内 RMBG-1.4（`@huggingface/transformers`）对前景真抠图，模型与 ONNX runtime wasm 全部本地加载、不联网；任何失败自动回退用原图。（曾尝试 HF serverless 抠图——其不托管通用抠图模型；以及“绿幕提示词 + 扣色”——生成不稳定、易啃主体，均放弃。）
- **多画布**：引擎以页快照维护多张画布，新建画布保留旧画布内容，可语音切换；背景随画布独立保存、可撤销。
- **画布背景**：纯色或 AI 文生图铺满整张画布（cover 适配），区别于在画布上摆一张小图。
- **指令鲁棒性**：区分“向右移动 100 像素”（相对位移）与“移到左上角”（绝对定位）；箭头按“向上/下/左/右”确定朝向；切换画布容忍识别变体（缺“到”、阿拉伯数字、无动词的「第二张画布」）。
- **关键词重叠修复**：`熊猫` 不再命中 `猫` 预设；只有“小猫/猫咪/非熊猫的猫”才走 cat 组合预设。
- **防重叠摆放**：`autoPlace` 在未指定方位时按已有图元边界选择空闲锚点，避免组合图形全堆中心。

## 后端

后端只保留密钥隔离和安全边界：

- `POST /api/imagine`：代理 Hugging Face 文生图，默认模型 `black-forest-labs/FLUX.1-schnell`。
- `POST /api/cutout`：可选的服务端抠图代理（配置可用的抠图服务 `HF_CUTOUT_URL` 时启用；默认前端走本地 RMBG，不调用它）。
- `GET /api/health`：返回后端在线状态、HF token 是否配置、当前模型。
- `security.ts`：CORS allowlist 与内存限流。

## 模型资产

前景抠图模型（RMBG-1.4 量化 onnx，约 42MB）与 ONNX runtime wasm 不随仓库分发（已 gitignore）。运行 `cd backend && npm run fetch-models` 经代理下载到 `frontend/public/models` 与 `frontend/public/ort`。未下载时绘图与文生图仍可用，只是前景不抠背景。

## 已知限制

- 首次抠图需加载约 42MB 模型并初始化 wasm，有几秒延迟；之后走浏览器缓存。
- HF Inference API 受 token 权限、模型可用性、冷启动、限流影响；失败时几何绘图不受影响。
- 文生图/抠图产出的是 image 图元，不能像几何图元一样拆开编辑内部结构。
- Web Speech 依赖浏览器实现（Chrome/Edge 较好），对口音与措辞变体仍有识别偏差。
- 真实麦克风、浏览器权限弹窗、HF 线上可用性仍需真机/E2E 回归。

## 验收

- `npm test`
- `npm run build`
- `npm run lint`
- `npm audit`
- 浏览器手测：开始聆听、画圆、画熊猫（抠图合成）、改色、把它移到左上角、画一个向上的箭头、新建画布 / 切换画布、把背景改成山林、撤销、保存、打开 / 关闭帮助。
