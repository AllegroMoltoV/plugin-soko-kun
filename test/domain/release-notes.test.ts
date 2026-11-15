// リリースノートの照合の境界。危険側は、リリースノートに書いた案内で重大の判定を逃れられること、
// 照合や承認の後に本文へ案内を足して掲載を続けられること。
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { getPluginView } from '../../src/domain/catalog';
import { releaseNotesStatement } from '../../src/domain/release-notes';
import { submitPlugin } from '../../src/domain/submit';
import { judgeByRules, type RepositorySnapshot } from '../../src/review/rules';
import { markListable } from '../fixtures/checks';
import { githubHandlers, OWNER, REPO, USER_TOKEN } from '../fixtures/github';
import { network } from '../setup';

const BYPASS = 'Run xattr -cr /Applications/OBS.app/Contents/PlugIns/plugin.plugin before starting OBS.';

async function registerListed(): Promise<number> {
  network.use(...githubHandlers());
  const result = await submitPlugin(
    env,
    { githubUserId: 4242, githubToken: USER_TOKEN },
    `https://github.com/${OWNER}/${REPO}`,
  );
  if (!result.ok) throw new Error(result.code);
  network.resetHandlers();
  await markListable(env.DB);
  const row = await env.DB.prepare('SELECT github_release_id AS id FROM releases').first<{ id: number }>();
  return row?.id as number;
}

const slug = `${OWNER}/${REPO}`.toLowerCase();

describe('リリースノートの照合', () => {
  it('README に案内が無くても、リリースノートの案内で重大の not_met にする', () => {
    const snapshot: RepositorySnapshot = {
      paths: ['README.md'],
      truncated: false,
      files: [{ path: 'README.md', content: '# Plugin\n' }],
      unreadFiles: [],
      readmePath: 'README.md',
      releaseNotesHits: [{ line: 4, rule: 'no-security-bypass' }],
    };
    expect(judgeByRules(snapshot).find((entry) => entry.id === 'no-security-bypass')).toMatchObject({
      result: 'not_met',
      serious: true,
      evidence: [{ file: '(release notes)', lines: '4-4' }],
    });
  });

  it('照合の後に本文へ案内を足すと、承認済みの掲載中の版も確認待ちに戻る', async () => {
    const id = await registerListed();
    await env.DB.batch([await releaseNotesStatement(env.DB, id, 'Initial release.')]);
    await env.DB.prepare("UPDATE release_checks SET admin_approved_at = '2026-11-15T00:00:00Z'").run();
    expect((await getPluginView(env, slug))?.status).toBe('listed');

    await env.DB.batch([await releaseNotesStatement(env.DB, id, `Initial release.\n\n${BYPASS}`)]);
    const row = await env.DB.prepare(
      'SELECT notes_held, admin_approved_at FROM release_checks WHERE github_release_id = ?',
    )
      .bind(id)
      .first<{ notes_held: number; admin_approved_at: string | null }>();
    expect(row).toEqual({ notes_held: 1, admin_approved_at: null });
    expect((await getPluginView(env, slug))?.status).not.toBe('listed');
  });

  it('最初の照合と、案内の無い本文の編集では確認待ちにしない', async () => {
    const id = await registerListed();
    // 登録の時点の本文で照合したあとの状態から、案内の無い編集を行う。
    await env.DB.batch([await releaseNotesStatement(env.DB, id, 'Initial release.')]);
    await env.DB.batch([await releaseNotesStatement(env.DB, id, 'Initial release. Fixed a typo.')]);
    const row = await env.DB.prepare('SELECT notes_held FROM release_checks WHERE github_release_id = ?')
      .bind(id)
      .first<{ notes_held: number }>();
    expect(row?.notes_held).toBe(0);
    expect((await getPluginView(env, slug))?.status).toBe('listed');
  });
});
