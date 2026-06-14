import { useEffect, useState } from 'react';
import { useCanvasEngine } from '../engine/useCanvasEngine';
import { useDrawController } from '../controller/useDrawController';
import { useSpeech } from '../voice/useSpeech';
import { CommandConsole } from '../components/CommandConsole';
import { CanvasTips } from '../components/CanvasTips';
import { VoicePanel } from '../components/VoicePanel';
import { HelpOverlay } from '../components/HelpOverlay';
import type { VoiceControl } from '../voice/voiceControl';
import '../landing.css';
import '../studio.css';

interface HealthState {
  ok: boolean;
  hfConfigured: boolean;
}

export default function StudioApp() {
  const { wrapRef, canvasRef, engine, state } = useCanvasEngine();
  const [health, setHealth] = useState<HealthState | null>(null);
  const speech = useSpeech();
  const { run, log } = useDrawController(engine.current, speech.speakFeedback);
  const [showHelp, setShowHelp] = useState(false);

  const handleVoiceControl = (control: VoiceControl) => {
    if (control.type === 'helpOpen') setShowHelp(true);
    if (control.type === 'helpClose') setShowHelp(false);
    if (control.type === 'toggleTts') speech.setFeedbackEnabled(control.enabled);
  };

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth({ ok: d?.ok === true, hfConfigured: d?.hfConfigured === true }))
      .catch(() => setHealth({ ok: false, hfConfigured: false }));
  }, []);

  const backendLabel = health === null
    ? '检测中'
    : health.ok
      ? health.hfConfigured ? '已连接 · 文生图' : '已连接 · 无 HF'
      : '未连接';

  const backendChipClass = health === null
    ? 'app__chip'
    : health.ok
      ? 'app__chip app__chip--ok'
      : 'app__chip app__chip--bad';

  return (
    <div className="app app--studio">
      <div className="app__ribbons" aria-hidden>
        <div className="landing__ribbon landing__ribbon--a" />
        <div className="landing__ribbon landing__ribbon--b" />
        <div className="landing__ribbon landing__ribbon--d" />
        <div className="landing__ribbon landing__ribbon--c" />
        <div className="landing__grain" />
      </div>

      <header className="app__header">
        <a className="app__home-link font-firs" href="/">sonicraft</a>
        <div className="app__header-meta">
          <span className={backendChipClass}>{backendLabel}</span>
          <span className="app__chip">图 {state.shapes.length}</span>
          {state.selectedIds.length > 0 && (
            <span className="app__chip">选 {state.selectedIds.length}</span>
          )}
          {health?.ok && !health.hfConfigured && (
            <span className="app__chip app__chip--warn">HF 未配置</span>
          )}
        </div>
      </header>

      <div className="app__body">
        <div className="canvas-wrap" ref={wrapRef}>
          <div className="canvas-stage">
            <span className="canvas-bracket canvas-bracket--tl" aria-hidden />
            <span className="canvas-bracket canvas-bracket--tr" aria-hidden />
            <span className="canvas-bracket canvas-bracket--bl" aria-hidden />
            <span className="canvas-bracket canvas-bracket--br" aria-hidden />
            <canvas ref={canvasRef} />
            {log.length === 0 && state.shapes.length === 0 && <CanvasTips />}
          </div>
        </div>
        <aside className="app__side">
          <VoicePanel
            run={run}
            ttsEnabled={speech.enabled}
            onVoiceControl={handleVoiceControl}
          />
          <CommandConsole log={log} />
        </aside>
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
