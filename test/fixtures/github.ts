// GitHub API のモック。フィクスチャの利用者名は依頼者のハンドルを使う (software-test スキル)。
import { HttpResponse, http } from 'msw';

export const OWNER = 'allegromoltov';
export const REPO = 'obs-fixture-pitchshift';
export const REPO_ID = 900001;
export const USER_TOKEN = 'gho_fixture_user_token';

export interface RepoFixture {
  admin?: boolean;
  private?: boolean;
  archived?: boolean;
  license?: string | null;
  languages?: Record<string, number>;
  cmake?: string | null;
  release?: 'none' | 'no-digest' | 'ok';
}

export const OBS_CMAKE =
  'cmake_minimum_required(VERSION 3.28)\nproject(obs-fixture-pitchshift)\nfind_package(libobs REQUIRED)\n';

export function githubHandlers(fixture: RepoFixture = {}, calls: string[] = []) {
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const track = (label: string) => calls.push(label);
  const asset = (id: number, name: string, digest: string | null) => ({
    id,
    name,
    size: 1_436_099,
    digest,
    browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/v1.1.0/${name}`,
  });
  return [
    http.get(base, ({ request }) => {
      track(`repo:${request.headers.get('Authorization')?.split(' ')[0]}`);
      return HttpResponse.json({
        id: REPO_ID,
        name: REPO,
        owner: { login: OWNER },
        private: fixture.private ?? false,
        archived: fixture.archived ?? false,
        description: 'Real-time <script>alert(1)</script> pitch shift filter',
        default_branch: 'main',
        license: fixture.license === null ? null : { spdx_id: fixture.license ?? 'GPL-2.0' },
        permissions: { admin: fixture.admin ?? true, pull: true },
      });
    }),
    http.get(`${base}/languages`, () => {
      track('languages');
      return HttpResponse.json(fixture.languages ?? { 'C++': 12000, CMake: 800 });
    }),
    http.get(`${base}/contents/CMakeLists.txt`, () => {
      track('cmake');
      if (fixture.cmake === null) return new HttpResponse(null, { status: 404 });
      return HttpResponse.text(fixture.cmake ?? OBS_CMAKE);
    }),
    http.get(`${base}/releases/latest`, () => {
      track('release');
      if (fixture.release === 'none') return new HttpResponse(null, { status: 404 });
      const digest = fixture.release === 'no-digest' ? null : `sha256:${'d1'.repeat(32)}`;
      return HttpResponse.json(
        {
          id: 7001,
          tag_name: 'v1.1.0',
          name: 'v1.1.0',
          draft: false,
          prerelease: false,
          published_at: '2026-10-20T00:00:00Z',
          html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.1.0`,
          assets: [
            asset(8001, 'obs-fixture-pitchshift-1.1.0-windows-x64.zip', digest),
            asset(8002, 'obs-fixture-pitchshift-1.1.0-source.tar.gz', digest ? `sha256:${'e2'.repeat(32)}` : null),
          ],
        },
        { headers: { ETag: '"etag-1"' } },
      );
    }),
    http.get(`${base}/commits/v1.1.0`, () => {
      track('commit');
      return HttpResponse.json({ sha: '3f2a9c1000000000000000000000000000000000' });
    }),
    http.get(`${base}/readme`, () => {
      track('readme');
      return HttpResponse.text('# Title\n\nA pitch shift filter.\n');
    }),
  ];
}

// リポジトリの .soko-kun/ に置いた画像。files を渡さなければ、画像の無いリポジトリとして 404 を返す。
export function imageHandlers(files?: Record<string, Uint8Array>, calls: string[] = []) {
  const contents = 'https://api.github.com/repos/:owner/:repo/contents/.soko-kun';
  return [
    http.get(contents, () => {
      calls.push('images:list');
      if (!files) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json(
        Object.entries(files).map(([name, bytes]) => ({
          name,
          type: 'file',
          size: bytes.length,
          sha: `sha-${name}-${bytes.length}`,
        })),
      );
    }),
    http.get(`${contents}/:file`, ({ params }) => {
      calls.push(`images:get:${params.file}`);
      const bytes = files?.[String(params.file)];
      if (!bytes) return new HttpResponse(null, { status: 404 });
      return new HttpResponse(bytes, { headers: { 'Content-Length': String(bytes.length) } });
    }),
  ];
}
