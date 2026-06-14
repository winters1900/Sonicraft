import { isValidCommand, type DrawCommand } from '@shared/commands';
import { parseWithRules } from './RuleParser';

export type ParseSource = 'rule' | 'rule-fallback';

export interface RouteResult {
  commands: DrawCommand[];
  source: ParseSource;
  ms: number;
}

export interface RouterOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function routeCommand(text: string, _opts: RouterOptions = {}): Promise<RouteResult> {
  const t0 = now();
  const rule = parseWithRules(text);
  const source: ParseSource = rule.matched ? 'rule' : 'rule-fallback';
  return { commands: ensureNonEmpty(rule.commands, text), source, ms: round(now() - t0) };
}

function ensureNonEmpty(cmds: DrawCommand[], text: string): DrawCommand[] {
  const valid = cmds.filter(isValidCommand);
  return valid.length ? valid : [{ op: 'unknown', raw: text, reason: '未能理解该指令' }];
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
