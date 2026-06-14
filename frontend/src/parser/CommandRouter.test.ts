import { describe, expect, it } from 'vitest';
import { routeCommand } from './CommandRouter';

describe('CommandRouter local routing', () => {
  it('returns rule commands without backend fetch', async () => {
    const r = await routeCommand('画一个红色的圆');
    expect(r.source).toBe('rule');
    expect(r.commands[0]).toMatchObject({ op: 'create', shape: 'circle' });
  });

  it('routes arbitrary drawable objects to imagine', async () => {
    const r = await routeCommand('画一只熊猫');
    expect(r.source).toBe('rule');
    expect(r.commands[0]).toMatchObject({ op: 'imagine', prompt: '熊猫' });
  });

  it('returns unknown when no drawing intent exists', async () => {
    const r = await routeCommand('今天天气怎么样');
    expect(r.source).toBe('rule-fallback');
    expect(r.commands[0].op).toBe('unknown');
  });
});
