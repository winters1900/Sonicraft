import type { LogEntry } from '../controller/useDrawController';
import type { ParseSource } from '../parser/CommandRouter';

const SOURCE_LABEL: Record<ParseSource, string> = {
  rule: '规则',
  llm: 'AI',
  'llm-fallback-rule': 'AI→规则',
};

interface Props {
  log: LogEntry[];
}

// 识别日志（只读）：展示每条语音指令的识别文本、解析来源/耗时与执行结果。
// 纯语音工具不提供键盘输入入口，执行逻辑统一在 useDrawController。
export function CommandConsole({ log }: Props) {
  return (
    <div className="console">
      <div className="console__log">
        {log.length === 0 && <div className="console__hint">开始聆听后，说出的指令会显示在这里。</div>}
        {log.map((e) => (
          <div key={e.id} className="console__entry">
            <div className="console__cmd">
              <span>🎤 {e.text}</span>
              <span className="console__badge">{SOURCE_LABEL[e.source]} · {e.ms}ms</span>
            </div>
            {e.results.map((r, i) => (
              <div key={i} className={r.ok ? 'console__ok' : 'console__fail'}>
                {r.ok ? '✓' : '✗'} {r.message}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
