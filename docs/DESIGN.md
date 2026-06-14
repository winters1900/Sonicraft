# Sonicraft 设计说明

## 目标

应用面向“不能使用鼠标或键盘”的绘图场景。首次浏览器麦克风授权除外，核心操作通过语音完成：聆听控制、绘图、编辑、撤销、保存、帮助、反馈开关。

## 当前实现

```text
麦克风
  ├─ WhisperAsrEngine：浏览器内 VAD 断句 -> Transformers.js Whisper -> 中文文本
  └─ WebSpeechEngine：浏览器原生识别兜底
文本
  └─ RuleParser：中文规则 -> DrawCommand[]
        ├─ create/compose/move/recolor/undo/export 等结构化命令
        └─ imagine：任意物体 prompt
执行
  ├─ CommandExecutor：几何和组合图形，事务执行，失败回滚
  ├─ imagineClient：POST /api/imagine -> 图片 dataURL
  └─ CanvasEngine：几何图元 + image 图元渲染
反馈
  └─ SpeechSynthesis + TTS gate
```

## 关键决策

- **弃用七牛**：移除七牛 ASR、LLM、TTS、Kodo 与相关环境变量。旧 REST ASR 需要对象存储中转，延迟和配置复杂度都不适合当前目标。
- **ASR 本地化**：`Xenova/whisper-small` 在浏览器内运行。首次下载模型较慢，后续走浏览器缓存；Web Speech 用于轻量兜底。
- **几何与 AI 分工**：圆、方、移动、改色等结构化命令仍走本地规则，延迟低且可编辑；“熊猫/芒果/汽车”等开放物体走 HF 文生图，作为 image 图元进入画布。
- **关键词重叠修复**：`熊猫` 不再命中 `猫` 预设；只有“小猫/猫咪/非熊猫的猫”才走 cat 组合预设。
- **防重叠摆放**：新增 `autoPlace`，在未指定方位时按已有图元边界选择空闲锚点，避免组合图形全堆中心。

## 后端

后端只保留密钥隔离和安全边界：

- `POST /api/imagine`：代理 Hugging Face 文生图，默认模型 `black-forest-labs/FLUX.1-schnell`。
- `GET /api/health`：返回后端在线状态、HF token 是否配置、当前模型。
- `security.ts`：CORS allowlist 与内存限流。

## 已知限制

- Whisper 首次加载模型会明显慢；演示前建议预热一次。
- HF Inference API 受 token 权限、模型可用性、冷启动、限流影响；失败时几何绘图不受影响。
- 文生图生成的是 image 图元，不能像几何图元一样拆开编辑内部结构。
- 真实麦克风、浏览器权限弹窗、HF 线上可用性仍需真机/E2E 回归。

## 验收

- `npm test`
- `npm run build`
- `npm run lint`
- `npm audit`
- 浏览器手测：开始聆听、画圆、画熊猫、改色、撤销、保存、打开/关闭帮助、切换 Whisper/Web Speech。
