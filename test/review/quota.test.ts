// Workers AI の無料枠の不足と混雑の扱い。危険側ではなく、作者を理由なく管理者の確認待ちに回さないことを確かめる。
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { classifyAiError, nextQuotaReset, reviewRepository } from '../../src/domain/release-checks';
import type { Env } from '../../src/env';

const collected = { files: [], unreadFiles: [] };
const envThrowing = (message: string) =>
  ({
    AI: {
      run: async () => {
        throw new Error(message);
      },
    },
  }) as unknown as Env;

describe('Workers AI の例外の分類', () => {
  it('無料枠の不足と混雑だけを、失敗と分けて扱う', () => {
    expect(classifyAiError(new Error('AiError: 3036: You have used up your daily free allocation'))).toEqual({
      kind: 'quota',
    });
    expect(classifyAiError(new Error('AiError: 3040: Capacity temporarily exceeded'))).toEqual({ kind: 'busy' });
    expect(classifyAiError(new Error('AiError: 3046: Request timeout'))).toEqual({ kind: 'failed' });
    // 形の分からない例外は、今までどおり失敗として数える。
    expect(classifyAiError(new Error('network error'))).toEqual({ kind: 'failed' });
  });

  it('無料枠の不足は、レビューの結果としてそのまま返す', async () => {
    const outcome = await reviewRepository(
      envThrowing('AiError: 3036: daily free allocation'),
      new Budget(),
      'a/b',
      collected,
      null,
    );
    expect(outcome).toEqual({ kind: 'quota' });
  });

  it('枠が戻る時刻は次の 00:00 UTC', () => {
    expect(nextQuotaReset(new Date('2026-11-13T23:59:00Z'))).toBe('2026-11-14T00:00:00.000Z');
    expect(nextQuotaReset(new Date('2026-11-14T00:00:01Z'))).toBe('2026-11-15T00:00:00.000Z');
  });
});
