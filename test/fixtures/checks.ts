// 登録したリリースを、掲載の条件をすべて満たした状態にする。検査そのものを確かめないテストで使う。
export async function markListable(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("UPDATE scans SET result = 'not_found'"),
    db.prepare(
      "UPDATE release_checks SET immutable = 1, diff_state = 'skipped', config_state = 'missing', review_state = 'done'",
    ),
    db.prepare("UPDATE attestation_checks SET result = 'passed'"),
  ]);
}
