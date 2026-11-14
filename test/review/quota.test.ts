// Workers AI の無料枠の不足と混雑の扱い。危険側ではなく、作者を理由なく管理者の確認待ちに回さないことを確かめる。
import { describe, expect, it } from 'vitest';
import { Budget } from '../../src/budget';
import { classifyAiError, quotaRetryAt, reviewRepository } from '../../src/domain/release-checks';
import type { Env } from '../../src/env';

const collected = { paths: [], truncated: false, files: [], unreadFiles: [] };
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
    // 2026-11-13 に binding で実際に受けた例外のメッセージ。
    expect(
      classifyAiError(
        new Error(
          "AiError: 4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan",
        ),
      ),
    ).toEqual({ kind: 'quota' });
    // 公式の文書の表に載っているコード。
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
      envThrowing('AiError: 4006: you have used up your daily free allocation of 10,000 neurons'),
      new Budget(),
      'a/b',
      collected,
      null,
    );
    expect(outcome).toEqual({ kind: 'quota' });
  });

  it('無料枠の不足のあとは、時刻によらず 1 時間後にやり直す', () => {
    expect(quotaRetryAt(new Date('2026-11-14T00:00:27Z'))).toBe('2026-11-14T01:00:27.000Z');
    expect(quotaRetryAt(new Date('2026-11-14T23:30:00Z'))).toBe('2026-11-15T00:30:00.000Z');
  });
});
