// scripts/admin.mjs は wrangler を起動する単体のスクリプトのため、試行の上限の値が src/domain/status.ts とずれていないことだけを確かめる。
// ずれると、管理者の確認待ちとして数える行と、やり直しで戻す行が、Worker の算出と食い違う。
import { describe, expect, it } from 'vitest';
import script from '../scripts/admin.mjs?raw';
import { MAX_ATTESTATION_ATTEMPTS, MAX_SCAN_ATTEMPTS } from '../src/domain/status';

const constantOf = (name: string) => Number(new RegExp(`^const ${name} = (\\d+);`, 'm').exec(script)?.[1]);

describe('管理用スクリプトの試行の上限', () => {
  it.each([
    ['MAX_ATTESTATION_ATTEMPTS', MAX_ATTESTATION_ATTEMPTS],
    ['MAX_SCAN_ATTEMPTS', MAX_SCAN_ATTEMPTS],
  ])('%s は src/domain/status.ts の値と一致する', (name, expected) => {
    expect(constantOf(name)).toBe(expected);
  });
});
