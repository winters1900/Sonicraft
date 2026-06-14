import type { CanvasEngine } from '../engine/CanvasEngine';
import type { ShapeType } from '../engine/shapes';
import { PRESETS } from '../executor/presets';

// 仅用于开发期手动验证绘图引擎；正式语音链路接入后会从主界面移除。
// 通过随机偏移放置图形，避免叠在同一处。
export function DebugToolbar({ engine }: { engine: CanvasEngine | null }) {
  if (!engine) return null;

  const rand = () => ({
    x: 150 + Math.random() * (engine.width - 300),
    y: 120 + Math.random() * (engine.height - 240),
  });
  const colors = ['#e23b3b', '#2f7be2', '#2fae5a', '#e2a72f', '#222222'];
  const pick = () => colors[Math.floor(Math.random() * colors.length)];

  const addShapes: ShapeType[] = ['circle', 'rect', 'triangle', 'line', 'arrow', 'text'];
  const newShapes: ShapeType[] = ['ellipse', 'polygon', 'star', 'heart', 'arc'];
  const presetNames = Object.keys(PRESETS);

  return (
    <div className="debug-toolbar">
      <span className="debug-toolbar__tag">DEBUG</span>
      {addShapes.map((t) => (
        <button key={t} onClick={() => engine.add(t, { ...rand(), color: pick() })}>
          +{t}
        </button>
      ))}
      {newShapes.map((t) => (
        <button key={t} onClick={() => engine.add(t, { ...rand(), color: pick(), fill: t !== 'arc' })}>
          +{t}
        </button>
      ))}
      <span className="debug-toolbar__sep" />
      {presetNames.map((name) => (
        <button key={name} onClick={() => engine.addMany(PRESETS[name](engine.width / 2, engine.height / 2, 1, ''))}>
          ◈{name}
        </button>
      ))}
      <span className="debug-toolbar__sep" />
      <button onClick={() => engine.scale(1.2)}>放大</button>
      <button onClick={() => engine.scale(0.8)}>缩小</button>
      <button onClick={() => engine.recolor(pick())}>变色</button>
      <button onClick={() => engine.remove()}>删除选中</button>
      <span className="debug-toolbar__sep" />
      <button onClick={() => engine.undo()}>撤销</button>
      <button onClick={() => engine.redo()}>重做</button>
      <button onClick={() => engine.clear()}>清空</button>
    </div>
  );
}
