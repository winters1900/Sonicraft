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
      <p className="studio-label">输出</p>
      <div className="console__log">
        {log.length === 0 && (
          <p className="console__empty">等待语音指令…</p>
        )}
        {log.map((e) => {
          const failed = e.results.some((r) => !r.ok);
          const ok = e.results.length > 0 && e.results.every((r) => r.ok);
          return (
          <div
            key={e.id}
            className={`console__entry${ok ? ' console__entry--ok' : failed ? ' console__entry--fail' : ''}`}
          >
            <div className="console__cmd">
              <span className="console__text">{e.text}</span>
              <span className="console__badge">{SOURCE_LABEL[e.source]} · {e.ms}ms</span>
            </div>
            {e.results.map((r, i) => (
              <div key={i} className={r.ok ? 'console__ok' : 'console__fail'}>
                {r.ok ? '成功' : '失败'}：{r.message}
              </div>
            ))}
          </div>
          );
        })}
      </div>
    </div>
  );
}
