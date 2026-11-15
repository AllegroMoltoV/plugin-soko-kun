// Workers AI の呼び出しを AI Gateway に通すための第 3 引数。ID が無い環境 (手元とテスト) ではゲートウェイを通さない。
// 本番はゲートウェイの支出の上限で、姉妹版と合わせた Workers AI の費用を止める (docs/design/architecture.md)。
export function gatewayOptions(gatewayId: string | undefined): { gateway: { id: string } } | undefined {
  return gatewayId ? { gateway: { id: gatewayId } } : undefined;
}
