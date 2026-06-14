import type { LogEntry } from '../controller/useDrawController';
import type { ParseSource } from '../parser/CommandRouter';

const SOURCE_LABEL: Record<ParseSource, string> = {
  rule: '本地规则',
  'rule-fallback': '本地兜底',
};

interface Props {
  log: LogEntry[];
}

export function CommandConsole({ log }: Props) {
  return (
    <div className="console">
      <div className="console__log">
        {log.length === 0 && <div className="console__hint">开始聆听后，语音指令会显示在这里。</div>}
        {log.map((e) => (
          <div key={e.id} className="console__entry">
            <div className="console__cmd">
              <span>{e.text}</span>
              <span className="console__badge">{SOURCE_LABEL[e.source]} · {e.ms}ms</span>
            </div>
            {e.results.map((r, i) => (
              <div key={i} className={r.ok ? 'console__ok' : 'console__fail'}>
                {r.ok ? '成功' : '失败'}：{r.message}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
