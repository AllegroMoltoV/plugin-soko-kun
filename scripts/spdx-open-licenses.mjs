// ライセンスの判定の合格の集合 src/domain/spdx-open-licenses.json を、SPDX License List の固定した版から作り直す。
// 合格の集合は、isOsiApproved か isFsfLibre が true のライセンスの識別子 (docs/design/scanning.md の「ライセンスの判定」)。
// 使い方: node scripts/spdx-open-licenses.mjs
// 版を上げるときは VERSION と SHA256 を書き換えて実行し、差分を確かめてからコミットする。
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const VERSION = 'v3.29.0';
// v3.29.0 の json/licenses.json の SHA-256。取得した本文が固定した版と同じであることを確かめる。
const SHA256 = '47d1cc681abe31166b342b6cc4aab13a6ba8ea5c48794697fe3bf8b1dbaf509a';
const SOURCE = `https://raw.githubusercontent.com/spdx/license-list-data/${VERSION}/json/licenses.json`;
const OUTPUT = new URL('../src/domain/spdx-open-licenses.json', import.meta.url);

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`failed to fetch ${SOURCE}: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== SHA256) throw new Error(`unexpected SHA-256 ${digest} for ${SOURCE}`);

const list = JSON.parse(bytes.toString('utf8'));
const ids = list.licenses
  .filter((license) => license.isOsiApproved === true || license.isFsfLibre === true)
  .map((license) => license.licenseId)
  .sort();

const output = {
  source: SOURCE,
  sha256: SHA256,
  licenseListVersion: list.licenseListVersion,
  releaseDate: list.releaseDate,
  ids,
};
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${ids.length} license IDs from SPDX License List ${list.licenseListVersion}`);
