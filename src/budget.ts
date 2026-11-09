// 無料プランの 1 回の起動あたりの上限 (外部呼び出し 50 件、D1 クエリ 50 件) に余裕を残して収めるための予算。
export class BudgetExceededError extends Error {
  constructor(readonly kind: 'subrequest' | 'd1') {
    super(`${kind} budget exceeded`);
    this.name = 'BudgetExceededError';
  }
}

export class Budget {
  private subrequestsUsed = 0;
  private d1QueriesUsed = 0;

  constructor(
    readonly maxSubrequests = 45,
    readonly maxD1Queries = 45,
  ) {}

  get subrequests(): number {
    return this.subrequestsUsed;
  }

  get d1Queries(): number {
    return this.d1QueriesUsed;
  }

  canFetch(count = 1): boolean {
    return this.subrequestsUsed + count <= this.maxSubrequests;
  }

  takeSubrequest(): void {
    if (!this.canFetch()) throw new BudgetExceededError('subrequest');
    this.subrequestsUsed += 1;
  }

  canQuery(count = 1): boolean {
    return this.d1QueriesUsed + count <= this.maxD1Queries;
  }

  takeD1Query(): void {
    if (!this.canQuery()) throw new BudgetExceededError('d1');
    this.d1QueriesUsed += 1;
  }
}

const MAX_REDIRECTS = 3;

// リダイレクトも 1 件として数えられるため、手動で追って予算から引く。
export async function budgetedFetch(budget: Budget, url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; ; hop += 1) {
    budget.takeSubrequest();
    const response = await fetch(current, { ...init, redirect: 'manual' });
    const location = response.headers.get('Location');
    if (response.status >= 300 && response.status < 400 && location && hop < MAX_REDIRECTS) {
      await response.body?.cancel();
      const next = new URL(location, current);
      // リダイレクト先も固定のホストに限る。外部のホストへ誘導されないようにするため。
      if (next.protocol !== 'https:' || next.host !== new URL(current).host) {
        throw new Error('redirect to a different host is not allowed');
      }
      current = next.toString();
      continue;
    }
    return response;
  }
}
