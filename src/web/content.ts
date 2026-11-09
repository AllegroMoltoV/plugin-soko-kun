// 固定ページの本文。英語版が正で、ほかの言語は参考訳。段落は平文で持ち、表示時にエスケープする。
import type { Lang } from './i18n';

export type PageKey = 'about' | 'security' | 'report' | 'privacy';

export interface PageContent {
  title: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

const REPO_URL = 'https://github.com/AllegroMoltoV/plugin-soko-kun';

const en: Record<PageKey, PageContent> = {
  about: {
    title: 'About and listing policy',
    sections: [
      {
        heading: 'What this service is',
        paragraphs: [
          'Plugin Soko-kun is an independent, open registry of third-party plugins for OBS Studio. It is an unofficial service and is not affiliated with, endorsed by, or connected to the OBS Project or OBS Forums.',
          'The registry does not host files. It records information from public GitHub repositories and links to the files that authors publish in GitHub Releases.',
        ],
      },
      {
        heading: 'Listing policy',
        paragraphs: [
          'A plugin is listed when its author, who administers the GitHub repository, submits it and it meets these conditions: the repository is public, a license is detected by GitHub, the root CMakeLists.txt references libobs, the latest release has files with a SHA-256 digest from GitHub, and the automated checks find no known threat.',
          'Whether AI was used to develop a plugin does not affect listing. The same conditions apply to every plugin. Disclosing the use of AI is not required.',
          'This platform does not certify safety or quality by listing a plugin, so check plugins yourself before using them.',
        ],
      },
      {
        heading: 'Use from AI agents (MCP)',
        paragraphs: [
          'Connect an MCP client to the endpoint /mcp on this site. In Claude Code, run: claude mcp add --transport http plugin-soko-kun <this site>/mcp',
          'Searching and viewing details work without signing in. To submit a repository, sign in with GitHub from the MCP client (in Claude Code, run /mcp). The service requests no GitHub scopes and does not get write access to your repositories.',
          'Example requests: "Find a pitch shift plugin that works on Windows", "Register the OBS plugin in this GitHub repository".',
        ],
      },
    ],
  },
  security: {
    title: 'Security and disclaimer',
    sections: [
      {
        heading: 'Automated checks',
        paragraphs: [
          'For each file in a release, the service records the SHA-256 digest that GitHub publishes and looks it up in VirusTotal and MalwareBazaar. Files are not downloaded by the service.',
          'A release is shown as checked only after every file has a result from both lookups. Releases that are waiting for checks, or whose checks failed, are not listed. When a new release is under check, the previously checked release stays listed.',
          'A file reported as malicious suspends the plugin. A file detected by only a few engines is held for review.',
        ],
      },
      {
        heading: 'Limits of the checks',
        paragraphs: [
          'The checks detect only threats already known to these databases. New or targeted malware may not be detected, so use plugins carefully even when nothing is detected.',
          'The digest identifies the file that GitHub served when it was recorded. Compare the SHA-256 of the file you download with the value shown here.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: [
          'This platform is provided as is, without warranty of any kind, so install plugins at your own risk. The authors of each plugin are responsible for their software.',
        ],
      },
    ],
  },
  report: {
    title: 'Report',
    sections: [
      {
        heading: 'Public reports',
        paragraphs: [
          `Report incorrect information or policy issues as an issue in the GitHub repository: ${REPO_URL}/issues`,
        ],
      },
      {
        heading: 'Private reports',
        paragraphs: [
          `Report suspected malware or security problems privately through GitHub private vulnerability reporting: ${REPO_URL}/security/advisories/new`,
          'Reports are reviewed by a person. A report alone does not suspend a listing. When a clear danger is confirmed, the listing is suspended and stays suspended even if the repository changes.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy',
    sections: [
      {
        heading: 'What is stored',
        paragraphs: [
          'When you sign in to submit a plugin, the service stores your GitHub user ID and login name, and the GitHub access token needed to check your repository permissions. The token is stored encrypted and is used only to check permissions on the repositories you submit.',
          'To limit abuse, the service stores a one-way hash of your IP address for a short time. Browsing the catalog does not require cookies, except one that remembers your language choice.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can revoke access at any time in GitHub settings under Applications. To ask for deletion of your data, open a private report as described on the Report page.',
        ],
      },
    ],
  },
};

const ja: Record<PageKey, PageContent> = {
  about: {
    title: '概要と掲載ポリシー',
    sections: [
      {
        heading: 'このサービスについて',
        paragraphs: [
          '配信プラグイン倉庫くんは OBS Studio 向けのサードパーティ製プラグインを集めた、独立したオープンなレジストリです。このプラットフォームは OBS Project および OBS Forums と関係のない非公式のサービスで、両者の承認や推奨を受けていません。',
          'このプラットフォームは配布物を保管しません。このプラットフォームは公開されている GitHub リポジトリの情報を記録し、作者が GitHub Releases で公開した配布物へ案内します。',
        ],
      },
      {
        heading: '掲載ポリシー',
        paragraphs: [
          'このプラットフォームは、GitHub リポジトリの管理者である作者が登録し、次の条件をすべて満たしたプラグインを掲載します。条件は、リポジトリが公開されていること、GitHub がライセンスを検出できること、直下の CMakeLists.txt が libobs を参照していること、最新のリリースに GitHub の SHA-256 が付いた配布物があること、自動検査で既知の脅威が検出されないことです。',
          '開発に AI を使ったかどうかは掲載に影響しません。このプラットフォームはすべてのプラグインに同じ条件を適用し、AI の使用の申告も求めません。',
          'このプラットフォームは掲載によって安全性や品質を認証しないので、各自で確かめてから利用してください。',
        ],
      },
      {
        heading: 'AI エージェントから使う (MCP)',
        paragraphs: [
          'MCP クライアントをこのサイトの /mcp に接続してください。Claude Code では次を実行してください: claude mcp add --transport http plugin-soko-kun <このサイト>/mcp',
          '検索と詳細の取得はサインインなしで使えます。リポジトリを登録するときは、MCP クライアントから GitHub でサインインしてください (Claude Code では /mcp を実行)。このプラットフォームは GitHub のスコープを求めず、リポジトリへの書き込み権限を得ません。',
          '話しかけ方の例:「Windows で動くピッチシフトのプラグインを探して」「この GitHub リポジトリの OBS プラグインを登録して」',
        ],
      },
    ],
  },
  security: {
    title: 'セキュリティと免責',
    sections: [
      {
        heading: '自動検査',
        paragraphs: [
          'このプラットフォームは、リリースの配布物ごとに GitHub が公開する SHA-256 を記録し、VirusTotal と MalwareBazaar で照会します。このプラットフォームは配布物をダウンロードしません。',
          'このプラットフォームは、すべての配布物で両方の照会結果がそろってから、検査済みとして表示します。検査待ちや検査に失敗したリリースは掲載しません。新しいリリースを検査しているあいだは、検査を通った前のリリースを掲載し続けます。',
          'マルウェアと判定された配布物があると、このプラットフォームはプラグインの掲載を停止します。少数のエンジンだけが検出した場合は、管理者が確認するまで掲載を保留します。',
        ],
      },
      {
        heading: '検査の限界',
        paragraphs: [
          '検査で検出できるのは、これらのデータベースに既に知られている脅威だけです。新しいマルウェアや標的型のマルウェアは検出できないことがあるので、検査で何も検出されなくても、注意して利用してください。',
          'SHA-256 は、記録した時点で GitHub が配布していたファイルを表します。ダウンロードしたファイルの SHA-256 をここに示した値と照合してください。',
        ],
      },
      {
        heading: '免責',
        paragraphs: [
          'このプラットフォームは現状のまま提供し、いかなる保証もしないので、プラグインは個人の責任にもとづき導入してください。各プラグインの責任はその作者にあります。',
        ],
      },
    ],
  },
  report: {
    title: '通報',
    sections: [
      {
        heading: '公開でよい通報',
        paragraphs: [
          `誤った情報や掲載ポリシーに関する問題は、GitHub リポジトリの Issues で報告してください: ${REPO_URL}/issues`,
        ],
      },
      {
        heading: '非公開の通報',
        paragraphs: [
          `マルウェアの疑いやセキュリティの問題は、GitHub の Private vulnerability reporting で非公開に通報してください: ${REPO_URL}/security/advisories/new`,
          '管理者は通報を確認してから対応を決めます。このプラットフォームは通報だけでは掲載を停止しません。管理者が明確な危険を確認した場合は掲載を停止し、リポジトリが更新されても停止を続けます。',
        ],
      },
    ],
  },
  privacy: {
    title: 'プライバシー',
    sections: [
      {
        heading: '保存する情報',
        paragraphs: [
          'プラグインを登録するためにサインインすると、このプラットフォームは GitHub のユーザー ID とログイン名と、リポジトリの権限の確認に使う GitHub のアクセストークンを保存します。このプラットフォームはトークンを暗号化して保存し、登録したリポジトリの権限の確認にだけ使います。',
          'このプラットフォームは乱用を防ぐため、IP アドレスを一方向のハッシュにして短期間保存します。カタログの閲覧では、選んだ言語を覚える cookie のほかは使いません。',
        ],
      },
      {
        heading: '利用者ができること',
        paragraphs: [
          'GitHub の設定の Applications から、いつでもアクセスを取り消せます。データの削除を求めるときは、通報ページの方法で非公開の通報を送ってください。',
        ],
      },
    ],
  },
};

type Translation = Record<PageKey, PageContent>;

const zhHans: Translation = {
  about: {
    title: '简介与收录政策',
    sections: [
      {
        heading: '关于本服务',
        paragraphs: [
          '配信プラグイン倉庫くん（Plugin Soko-kun）是一个独立、开放的 OBS Studio 第三方插件收录服务。本服务为非官方服务，与 OBS Project 及 OBS Forums 无关，也未获得其认可或推荐。',
          '本服务不保存文件。它记录公开 GitHub 仓库的信息，并引导用户前往作者在 GitHub Releases 发布的文件。',
        ],
      },
      {
        heading: '收录政策',
        paragraphs: [
          '由管理 GitHub 仓库的作者本人提交，并满足以下全部条件的插件将被收录：仓库为公开状态，GitHub 能检测到许可证，根目录的 CMakeLists.txt 引用了 libobs，最新发布中有带 GitHub SHA-256 的文件，自动检查未发现已知威胁。',
          '是否使用 AI 开发不影响收录。所有插件适用相同条件，也不要求申报 AI 的使用。',
          '本平台不会因收录而认证安全性或质量，请自行确认后再使用。',
        ],
      },
      {
        heading: '通过 AI 代理使用（MCP）',
        paragraphs: [
          '将 MCP 客户端连接到本站的 /mcp。在 Claude Code 中运行：claude mcp add --transport http plugin-soko-kun <本站>/mcp',
          '搜索和查看详情无需登录。提交仓库时，请在 MCP 客户端中使用 GitHub 登录（在 Claude Code 中运行 /mcp）。本服务不请求任何 GitHub 权限范围，也不会获得仓库的写入权限。',
          '示例：“帮我找一个能在 Windows 上使用的变调插件”“把这个 GitHub 仓库的 OBS 插件登记上去”',
        ],
      },
    ],
  },
  security: {
    title: '安全与免责声明',
    sections: [
      {
        heading: '自动检查',
        paragraphs: [
          '对于发布中的每个文件，本服务记录 GitHub 公布的 SHA-256，并在 VirusTotal 和 MalwareBazaar 中查询。本服务不下载文件。',
          '只有当所有文件都得到两项查询结果后，才显示为已检查。等待检查或检查失败的发布不会被收录。新发布检查期间，之前通过检查的发布将继续收录。',
          '如有文件被判定为恶意软件，将暂停该插件的收录。仅被少数引擎检出时，将保留待确认。',
        ],
      },
      {
        heading: '检查的局限',
        paragraphs: [
          '只能检出这些数据库中已知的威胁。新型或定向的恶意软件可能无法检出，因此即使未检出任何问题，也请谨慎使用。',
          'SHA-256 代表记录时 GitHub 提供的文件。请将下载文件的 SHA-256 与此处显示的值进行比对。',
        ],
      },
      {
        heading: '免责声明',
        paragraphs: ['本服务按现状提供，不作任何保证。安装插件的风险由用户自行承担。各插件由其作者负责。'],
      },
    ],
  },
  report: {
    title: '举报',
    sections: [
      {
        heading: '公开举报',
        paragraphs: [`错误信息或收录政策相关问题，请在 GitHub 仓库的 Issues 中提交：${REPO_URL}/issues`],
      },
      {
        heading: '非公开举报',
        paragraphs: [
          `疑似恶意软件或安全问题，请通过 GitHub 的 Private vulnerability reporting 非公开举报：${REPO_URL}/security/advisories/new`,
          '举报由人工确认。仅凭举报不会暂停收录。确认存在明确危险时将暂停收录，即使仓库更新也会继续暂停。',
        ],
      },
    ],
  },
  privacy: {
    title: '隐私',
    sections: [
      {
        heading: '保存的信息',
        paragraphs: [
          '为提交插件而登录时，本服务会保存您的 GitHub 用户 ID 和登录名，以及用于确认仓库权限的 GitHub 访问令牌。令牌加密保存，仅用于确认您所提交仓库的权限。',
          '为防止滥用，本服务会将 IP 地址进行单向哈希后短期保存。浏览目录时，除记住语言选择的 cookie 外不使用其他 cookie。',
        ],
      },
      {
        heading: '您可以做的事',
        paragraphs: [
          '您可以随时在 GitHub 设置的 Applications 中撤销访问权限。如需删除数据，请按举报页面的方法提交非公开举报。',
        ],
      },
    ],
  },
};

const zhHant: Translation = {
  about: {
    title: '簡介與收錄政策',
    sections: [
      {
        heading: '關於本服務',
        paragraphs: [
          '配信プラグイン倉庫くん（Plugin Soko-kun）是一個獨立、開放的 OBS Studio 第三方外掛收錄服務。本服務為非官方服務，與 OBS Project 及 OBS Forums 無關，也未獲得其認可或推薦。',
          '本服務不保存檔案。它記錄公開 GitHub 儲存庫的資訊，並引導使用者前往作者在 GitHub Releases 發布的檔案。',
        ],
      },
      {
        heading: '收錄政策',
        paragraphs: [
          '由管理 GitHub 儲存庫的作者本人提交，並滿足以下全部條件的外掛將被收錄：儲存庫為公開狀態，GitHub 能偵測到授權，根目錄的 CMakeLists.txt 參照了 libobs，最新發行中有帶 GitHub SHA-256 的檔案，自動檢查未發現已知威脅。',
          '是否使用 AI 開發不影響收錄。所有外掛適用相同條件，也不要求申報 AI 的使用。',
          '本平台不會因收錄而認證安全性或品質，請自行確認後再使用。',
        ],
      },
      {
        heading: '透過 AI 代理使用（MCP）',
        paragraphs: [
          '將 MCP 用戶端連接到本站的 /mcp。在 Claude Code 中執行：claude mcp add --transport http plugin-soko-kun <本站>/mcp',
          '搜尋與查看詳情無需登入。提交儲存庫時，請在 MCP 用戶端中以 GitHub 登入（在 Claude Code 中執行 /mcp）。本服務不要求任何 GitHub 權限範圍，也不會取得儲存庫的寫入權限。',
          '範例：「幫我找一個能在 Windows 上使用的變調外掛」「把這個 GitHub 儲存庫的 OBS 外掛登記上去」',
        ],
      },
    ],
  },
  security: {
    title: '安全與免責聲明',
    sections: [
      {
        heading: '自動檢查',
        paragraphs: [
          '對於發行中的每個檔案，本服務記錄 GitHub 公布的 SHA-256，並在 VirusTotal 與 MalwareBazaar 中查詢。本服務不下載檔案。',
          '只有當所有檔案都取得兩項查詢結果後，才顯示為已檢查。等待檢查或檢查失敗的發行不會被收錄。新發行檢查期間，先前通過檢查的發行將繼續收錄。',
          '如有檔案被判定為惡意軟體，將暫停該外掛的收錄。僅被少數引擎檢出時，將保留待確認。',
        ],
      },
      {
        heading: '檢查的限制',
        paragraphs: [
          '只能檢出這些資料庫中已知的威脅。新型或針對性的惡意軟體可能無法檢出，因此即使未檢出任何問題，也請謹慎使用。',
          'SHA-256 代表記錄時 GitHub 提供的檔案。請將下載檔案的 SHA-256 與此處顯示的值進行比對。',
        ],
      },
      {
        heading: '免責聲明',
        paragraphs: ['本服務按現狀提供，不作任何保證。安裝外掛的風險由使用者自行承擔。各外掛由其作者負責。'],
      },
    ],
  },
  report: {
    title: '檢舉',
    sections: [
      {
        heading: '公開檢舉',
        paragraphs: [`錯誤資訊或收錄政策相關問題，請在 GitHub 儲存庫的 Issues 中提交：${REPO_URL}/issues`],
      },
      {
        heading: '非公開檢舉',
        paragraphs: [
          `疑似惡意軟體或安全問題，請透過 GitHub 的 Private vulnerability reporting 非公開檢舉：${REPO_URL}/security/advisories/new`,
          '檢舉由人工確認。僅憑檢舉不會暫停收錄。確認存在明確危險時將暫停收錄，即使儲存庫更新也會繼續暫停。',
        ],
      },
    ],
  },
  privacy: {
    title: '隱私',
    sections: [
      {
        heading: '保存的資訊',
        paragraphs: [
          '為提交外掛而登入時，本服務會保存您的 GitHub 使用者 ID 與登入名稱，以及用於確認儲存庫權限的 GitHub 存取權杖。權杖加密保存，僅用於確認您所提交儲存庫的權限。',
          '為防止濫用，本服務會將 IP 位址進行單向雜湊後短期保存。瀏覽目錄時，除記住語言選擇的 cookie 外不使用其他 cookie。',
        ],
      },
      {
        heading: '您可以做的事',
        paragraphs: [
          '您可以隨時在 GitHub 設定的 Applications 中撤銷存取權限。如需刪除資料，請依檢舉頁面的方法提交非公開檢舉。',
        ],
      },
    ],
  },
};

const ko: Translation = {
  about: {
    title: '개요와 게재 정책',
    sections: [
      {
        heading: '이 서비스에 대하여',
        paragraphs: [
          '配信プラグイン倉庫くん(Plugin Soko-kun)은 OBS Studio용 서드파티 플러그인을 위한 독립적이고 개방된 레지스트리입니다. 비공식 서비스이며 OBS Project 및 OBS Forums와 관계가 없고, 승인이나 추천을 받지 않았습니다.',
          '이 서비스는 배포 파일을 보관하지 않습니다. 공개된 GitHub 저장소의 정보를 기록하고, 작성자가 GitHub Releases에 공개한 파일로 안내합니다.',
        ],
      },
      {
        heading: '게재 정책',
        paragraphs: [
          'GitHub 저장소의 관리자인 작성자가 등록하고 다음 조건을 모두 충족한 플러그인을 게재합니다. 저장소가 공개되어 있을 것, GitHub가 라이선스를 감지할 수 있을 것, 최상위 CMakeLists.txt가 libobs를 참조할 것, 최신 릴리스에 GitHub의 SHA-256이 붙은 파일이 있을 것, 자동 검사에서 알려진 위협이 검출되지 않을 것.',
          '개발에 AI를 사용했는지 여부는 게재에 영향을 주지 않습니다. 모든 플러그인에 같은 조건을 적용하며, AI 사용의 신고도 요구하지 않습니다.',
          '이 플랫폼은 게재를 통해 안전성이나 품질을 인증하지 않으므로, 직접 확인한 뒤에 이용해 주세요.',
        ],
      },
      {
        heading: 'AI 에이전트에서 사용하기 (MCP)',
        paragraphs: [
          'MCP 클라이언트를 이 사이트의 /mcp에 연결합니다. Claude Code에서는 다음을 실행합니다: claude mcp add --transport http plugin-soko-kun <이 사이트>/mcp',
          '검색과 상세 조회는 로그인 없이 사용할 수 있습니다. 저장소를 등록할 때는 MCP 클라이언트에서 GitHub로 로그인합니다(Claude Code에서는 /mcp 실행). 이 서비스는 GitHub 스코프를 요청하지 않으며 저장소에 대한 쓰기 권한을 얻지 않습니다.',
          '예: "Windows에서 동작하는 피치 시프트 플러그인을 찾아 줘", "이 GitHub 저장소의 OBS 플러그인을 등록해 줘"',
        ],
      },
    ],
  },
  security: {
    title: '보안과 면책',
    sections: [
      {
        heading: '자동 검사',
        paragraphs: [
          '릴리스의 파일마다 GitHub가 공개하는 SHA-256을 기록하고, VirusTotal과 MalwareBazaar에서 조회합니다. 이 서비스는 파일을 다운로드하지 않습니다.',
          '모든 파일에서 두 조회 결과가 갖추어진 뒤에 검사 완료로 표시합니다. 검사 대기 중이거나 검사에 실패한 릴리스는 게재하지 않습니다. 새 릴리스를 검사하는 동안에는 검사를 통과한 이전 릴리스를 계속 게재합니다.',
          '악성코드로 판정된 파일이 있으면 플러그인의 게재를 중지합니다. 소수의 엔진만 검출한 경우에는 확인을 위해 보류합니다.',
        ],
      },
      {
        heading: '검사의 한계',
        paragraphs: [
          '이 데이터베이스에 이미 알려진 위협만 검출할 수 있습니다. 새로운 악성코드나 표적형 악성코드는 검출하지 못할 수 있으므로, 아무것도 검출되지 않아도 주의해서 이용해 주세요.',
          'SHA-256은 기록 시점에 GitHub가 배포하던 파일을 나타냅니다. 다운로드한 파일의 SHA-256을 여기 표시된 값과 비교해 주세요.',
        ],
      },
      {
        heading: '면책',
        paragraphs: [
          '이 서비스는 있는 그대로 제공되며 어떠한 보증도 하지 않습니다. 플러그인 설치는 이용자 본인의 책임입니다. 각 플러그인의 책임은 그 작성자에게 있습니다.',
        ],
      },
    ],
  },
  report: {
    title: '신고',
    sections: [
      {
        heading: '공개 신고',
        paragraphs: [`잘못된 정보나 게재 정책에 관한 문제는 GitHub 저장소의 Issues로 접수합니다: ${REPO_URL}/issues`],
      },
      {
        heading: '비공개 신고',
        paragraphs: [
          `악성코드 의심이나 보안 문제는 GitHub의 Private vulnerability reporting으로 비공개 신고해 주세요: ${REPO_URL}/security/advisories/new`,
          '신고는 사람이 확인합니다. 신고만으로 게재를 중지하지는 않습니다. 명확한 위험이 확인되면 게재를 중지하며, 저장소가 갱신되어도 중지를 유지합니다.',
        ],
      },
    ],
  },
  privacy: {
    title: '개인정보',
    sections: [
      {
        heading: '저장하는 정보',
        paragraphs: [
          '플러그인 등록을 위해 로그인하면 GitHub 사용자 ID와 로그인 이름, 저장소 권한 확인에 쓰는 GitHub 액세스 토큰을 저장합니다. 토큰은 암호화하여 저장하며, 등록한 저장소의 권한 확인에만 사용합니다.',
          '남용을 막기 위해 IP 주소를 단방향 해시로 바꾸어 짧은 기간 저장합니다. 카탈로그 열람에서는 선택한 언어를 기억하는 쿠키 외에는 사용하지 않습니다.',
        ],
      },
      {
        heading: '이용자가 할 수 있는 일',
        paragraphs: [
          'GitHub 설정의 Applications에서 언제든지 접근을 취소할 수 있습니다. 데이터 삭제를 원하시면 신고 페이지의 방법으로 비공개 신고를 보내 주세요.',
        ],
      },
    ],
  },
};

const ptBR: Translation = {
  about: {
    title: 'Sobre e política de listagem',
    sections: [
      {
        heading: 'O que é este serviço',
        paragraphs: [
          'Plugin Soko-kun é um registro independente e aberto de plugins de terceiros para o OBS Studio. É um serviço não oficial, sem vínculo, aprovação ou recomendação do OBS Project ou do OBS Forums.',
          'O registro não hospeda arquivos. Ele registra informações de repositórios públicos do GitHub e aponta para os arquivos que os autores publicam no GitHub Releases.',
        ],
      },
      {
        heading: 'Política de listagem',
        paragraphs: [
          'Um plugin é listado quando o autor, que administra o repositório no GitHub, o envia e ele cumpre estas condições: o repositório é público, o GitHub detecta uma licença, o CMakeLists.txt da raiz referencia a libobs, a versão mais recente tem arquivos com SHA-256 do GitHub e as verificações automáticas não encontram ameaças conhecidas.',
          'O uso de IA no desenvolvimento não afeta a listagem. As mesmas condições valem para todos os plugins, e não é preciso declarar o uso de IA.',
          'Esta plataforma não certifica segurança nem qualidade ao listar um plugin; por isso, verifique os plugins antes de usá-los.',
        ],
      },
      {
        heading: 'Uso com agentes de IA (MCP)',
        paragraphs: [
          'Conecte um cliente MCP ao endereço /mcp deste site. No Claude Code, execute: claude mcp add --transport http plugin-soko-kun <este site>/mcp',
          'Buscar e ver detalhes funciona sem login. Para enviar um repositório, entre com o GitHub pelo cliente MCP (no Claude Code, execute /mcp). O serviço não pede escopos do GitHub e não recebe acesso de escrita aos seus repositórios.',
          'Exemplos: "Encontre um plugin de pitch shift que funcione no Windows", "Registre o plugin do OBS deste repositório do GitHub".',
        ],
      },
    ],
  },
  security: {
    title: 'Segurança e isenção de responsabilidade',
    sections: [
      {
        heading: 'Verificações automáticas',
        paragraphs: [
          'Para cada arquivo de uma versão, o serviço registra o SHA-256 publicado pelo GitHub e o consulta no VirusTotal e no MalwareBazaar. O serviço não baixa os arquivos.',
          'Uma versão só aparece como verificada depois que todos os arquivos têm resultado das duas consultas. Versões aguardando verificação ou com falha na verificação não são listadas. Enquanto uma nova versão é verificada, a versão verificada anterior continua listada.',
          'Um arquivo apontado como malicioso suspende o plugin. Um arquivo detectado por poucos mecanismos fica em espera para revisão.',
        ],
      },
      {
        heading: 'Limites das verificações',
        paragraphs: [
          'As verificações detectam apenas ameaças já conhecidas por essas bases. Malwares novos ou direcionados podem não ser detectados; por isso, use os plugins com cuidado mesmo quando nada for detectado.',
          'O SHA-256 identifica o arquivo que o GitHub servia no momento do registro. Compare o SHA-256 do arquivo baixado com o valor mostrado aqui.',
        ],
      },
      {
        heading: 'Isenção de responsabilidade',
        paragraphs: [
          'O serviço é fornecido como está, sem garantia de qualquer tipo. A instalação de plugins é por sua conta e risco. Os autores de cada plugin são responsáveis por seu software.',
        ],
      },
    ],
  },
  report: {
    title: 'Denunciar',
    sections: [
      {
        heading: 'Denúncias públicas',
        paragraphs: [
          `Informe dados incorretos ou problemas de política como issue no repositório do GitHub: ${REPO_URL}/issues`,
        ],
      },
      {
        heading: 'Denúncias privadas',
        paragraphs: [
          `Informe suspeitas de malware ou problemas de segurança de forma privada pelo private vulnerability reporting do GitHub: ${REPO_URL}/security/advisories/new`,
          'As denúncias são analisadas por uma pessoa. Uma denúncia, por si só, não suspende uma listagem. Quando um perigo claro é confirmado, a listagem é suspensa e continua suspensa mesmo que o repositório mude.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacidade',
    sections: [
      {
        heading: 'O que é armazenado',
        paragraphs: [
          'Ao entrar para enviar um plugin, o serviço armazena seu ID de usuário e nome de login do GitHub, além do token de acesso do GitHub necessário para verificar as permissões do repositório. O token é armazenado criptografado e usado apenas para verificar permissões nos repositórios que você envia.',
          'Para limitar abusos, o serviço armazena por pouco tempo um hash irreversível do seu endereço IP. Navegar pelo catálogo não usa cookies, exceto um que lembra o idioma escolhido.',
        ],
      },
      {
        heading: 'Suas opções',
        paragraphs: [
          'Você pode revogar o acesso a qualquer momento nas configurações do GitHub, em Applications. Para pedir a exclusão dos seus dados, envie uma denúncia privada como descrito na página Denunciar.',
        ],
      },
    ],
  },
};

const es419: Translation = {
  about: {
    title: 'Acerca de y política de la lista',
    sections: [
      {
        heading: 'Qué es este servicio',
        paragraphs: [
          'Plugin Soko-kun es un registro independiente y abierto de plugins de terceros para OBS Studio. Es un servicio no oficial y no tiene relación, aprobación ni recomendación de OBS Project ni de OBS Forums.',
          'El registro no aloja archivos. Registra información de repositorios públicos de GitHub y enlaza a los archivos que los autores publican en GitHub Releases.',
        ],
      },
      {
        heading: 'Política de la lista',
        paragraphs: [
          'Un plugin aparece en la lista cuando su autor, que administra el repositorio de GitHub, lo envía y cumple estas condiciones: el repositorio es público, GitHub detecta una licencia, el CMakeLists.txt de la raíz hace referencia a libobs, la versión más reciente tiene archivos con SHA-256 de GitHub y las revisiones automáticas no encuentran amenazas conocidas.',
          'Haber usado IA en el desarrollo no afecta la lista. Las mismas condiciones aplican a todos los plugins y no es necesario declarar el uso de IA.',
          'Esta plataforma no certifica la seguridad ni la calidad al incluir un plugin; por eso, revisa los plugins antes de usarlos.',
        ],
      },
      {
        heading: 'Uso con agentes de IA (MCP)',
        paragraphs: [
          'Conecta un cliente MCP a la dirección /mcp de este sitio. En Claude Code, ejecuta: claude mcp add --transport http plugin-soko-kun <este sitio>/mcp',
          'Buscar y ver detalles funciona sin iniciar sesión. Para enviar un repositorio, inicia sesión con GitHub desde el cliente MCP (en Claude Code, ejecuta /mcp). El servicio no pide alcances de GitHub ni obtiene acceso de escritura a tus repositorios.',
          'Ejemplos: "Busca un plugin de pitch shift que funcione en Windows", "Registra el plugin de OBS de este repositorio de GitHub".',
        ],
      },
    ],
  },
  security: {
    title: 'Seguridad y descargo de responsabilidad',
    sections: [
      {
        heading: 'Revisiones automáticas',
        paragraphs: [
          'Para cada archivo de una versión, el servicio registra el SHA-256 que publica GitHub y lo consulta en VirusTotal y MalwareBazaar. El servicio no descarga los archivos.',
          'Una versión se muestra como revisada solo cuando todos sus archivos tienen resultado de ambas consultas. Las versiones en espera de revisión o con revisiones fallidas no aparecen en la lista. Mientras se revisa una versión nueva, la versión revisada anterior sigue en la lista.',
          'Un archivo marcado como malicioso suspende el plugin. Un archivo detectado por pocos motores queda en espera de revisión.',
        ],
      },
      {
        heading: 'Límites de las revisiones',
        paragraphs: [
          'Las revisiones solo detectan amenazas ya conocidas por estas bases. El malware nuevo o dirigido podría no detectarse; por eso, usa los plugins con cuidado aunque no haya detecciones.',
          'El SHA-256 identifica el archivo que GitHub entregaba al momento del registro. Compara el SHA-256 del archivo descargado con el valor que se muestra aquí.',
        ],
      },
      {
        heading: 'Descargo de responsabilidad',
        paragraphs: [
          'El servicio se ofrece tal cual, sin garantía de ningún tipo. Instalas plugins bajo tu propio riesgo. Los autores de cada plugin son responsables de su software.',
        ],
      },
    ],
  },
  report: {
    title: 'Reportar',
    sections: [
      {
        heading: 'Reportes públicos',
        paragraphs: [
          `Reporta información incorrecta o problemas de política como issue en el repositorio de GitHub: ${REPO_URL}/issues`,
        ],
      },
      {
        heading: 'Reportes privados',
        paragraphs: [
          `Reporta sospechas de malware o problemas de seguridad en privado mediante el private vulnerability reporting de GitHub: ${REPO_URL}/security/advisories/new`,
          'Una persona revisa los reportes. Un reporte por sí solo no suspende una publicación. Cuando se confirma un peligro claro, la publicación se suspende y sigue suspendida aunque el repositorio cambie.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacidad',
    sections: [
      {
        heading: 'Qué se guarda',
        paragraphs: [
          'Al iniciar sesión para enviar un plugin, el servicio guarda tu ID de usuario y nombre de inicio de sesión de GitHub, y el token de acceso de GitHub necesario para revisar los permisos del repositorio. El token se guarda cifrado y solo se usa para revisar permisos en los repositorios que envías.',
          'Para limitar abusos, el servicio guarda por poco tiempo un hash irreversible de tu dirección IP. Navegar por el catálogo no usa cookies, salvo una que recuerda el idioma elegido.',
        ],
      },
      {
        heading: 'Tus opciones',
        paragraphs: [
          'Puedes revocar el acceso en cualquier momento en la configuración de GitHub, en Applications. Para pedir que se borren tus datos, envía un reporte privado como se describe en la página Reportar.',
        ],
      },
    ],
  },
};

export const PAGES: Record<Lang, Record<PageKey, PageContent>> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  'pt-BR': ptBR,
  'es-419': es419,
};
