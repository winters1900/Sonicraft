# Sonicraft

纯语音控制的 Canvas 绘图工具。目标：首次授权麦克风后，用户通过语音完成绘图、调整、撤销、保存、帮助开关与反馈开关。

## 演示视频

- B 站：<https://www.bilibili.com/video/BV1wzJK6zEhS/>
- 备用（南大网盘）：<https://box.nju.edu.cn/f/f2dd1295f0994e45aac4/>

## 当前架构

- **ASR**：默认浏览器内 Whisper（`@huggingface/transformers` + `Xenova/whisper-small`），无需后端密钥；Web Speech 可手动切换兜底。
- **指令理解**：本地规则解析几何、布局、样式、变换、撤销等高频命令；未知但有绘图意图的对象转为 `imagine`。
- **任意物体绘图**：后端代理 Hugging Face 文生图，默认 `black-forest-labs/FLUX.1-schnell`，生成图片图元落到画布。
- **TTS**：浏览器原生 `SpeechSynthesis`，播报期间有 TTS gate 抑制回声。

## 快速启动

```bash
npm run install:all
copy backend\.env.example backend\.env
# 在 backend\.env 写入新的 HF_TOKEN（不要使用已泄露 token）
npm run dev
```

前端默认 Vite 地址通常是 `http://localhost:5173`，后端默认 `http://localhost:8787`。

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
| 编辑变换 | 把它变成绿色 / 放大一点 / 向右移动100像素 / 旋转45度 |
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
  engine/       Canvas 图元、渲染、撤销
  executor/     DrawCommand 执行、预设组合、HF 图像客户端
  parser/       中文规则解析与黄金集
  voice/        Whisper/WebSpeech ASR、浏览器 TTS、语音控制
backend/src/
  routes/       Hugging Face 文生图代理
  security.ts   CORS 与限流
shared/         命令 DSL、颜色、中文数字
```
