// 固定ページの本文。利用規約とプライバシーポリシーは日本語版が正で、ほかのページは英語版が正。
// 段落は平文で持ち、表示のときにエスケープする。{{ORIGIN}} は表示のときにサイトの URL へ置き換える。
import type { Lang } from './i18n';

export const PAGE_KEYS = ['about', 'policy', 'submit', 'security', 'report', 'terms', 'privacy'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

// 本文の要素。文字列は段落、code はコードブロック、list は箇条書き。
// contact は「連絡先を表示」ボタン。アドレスは本文に書かない。
export type Block = string | { code: string } | { list: string[] } | { contact: true };

export interface PageContent {
  title: string;
  // id は見出しのアンカー。MCP の説明やスキルから節へ直接リンクするときに付ける。
  sections: Array<{ id?: string; heading: string; paragraphs: Block[] }>;
}

// 正とする版。利用規約とプライバシーポリシーは日本語版、ほかは英語版。
export const AUTHORITATIVE: Record<PageKey, Lang> = {
  about: 'en',
  policy: 'en',
  submit: 'en',
  security: 'en',
  report: 'en',
  terms: 'ja',
  privacy: 'ja',
};

export const PAGES: Record<Lang, Record<PageKey, PageContent>> = {
  en: {
    about: {
      title: 'What is Plugin Soko-kun?',
      sections: [
        {
          heading: 'What this service is',
          paragraphs: [
            'Plugin Soko-kun is an independent, open registry of third-party plugins for OBS Studio. It is an unofficial service that is not affiliated with the OBS Project or OBS Forums.',
            'The registry does not host files. It records information from public GitHub repositories and links to the files that authors publish in GitHub Releases.',
            'Download files directly from GitHub, because this platform does not host them.',
          ],
        },
        {
          heading: 'Use from AI agents (MCP)',
          paragraphs: [
            'Connect an MCP client to the endpoint /mcp on this site. In Claude Code, run:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'In Codex, run:',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            'Searching and viewing details work without signing in to GitHub. To submit a repository, sign in with GitHub from the MCP client (in Claude Code, run /mcp; in Codex, run codex mcp login plugin-soko-kun). This platform itself never gets write access to your GitHub repositories.',
            'Example requests: "Find a pitch shift plugin that works on Windows", "Register the OBS plugin in this GitHub repository", "Check whether my plugin\'s new release is listed".',
          ],
        },
        {
          heading: 'Supporting development',
          paragraphs: [
            'Plugin Soko-kun is free to use. If you would like to help with its running costs and development, you can sponsor the developer on GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
            'Sponsoring is optional. It has no effect on how plugins are listed or checked.',
          ],
        },
      ],
    },
    policy: {
      title: 'Listing policy',
      sections: [
        {
          heading: 'Listing policy',
          paragraphs: [
            'This platform lists plugins that the author, who administers the GitHub repository, submits and that meet all of the following conditions.',
            {
              list: [
                'The repository is public on GitHub and is not archived.',
                'GitHub detects a license for the repository. Add a LICENSE file if GitHub shows no license.',
                'The CMakeLists.txt at the root of the repository references libobs, for example with find_package(libobs), and the repository contains C or C++ sources.',
                'The latest release on GitHub has the plugin files attached. GitHub records a SHA-256 digest for files uploaded to a release, and this platform uses that digest for checks.',
                'The latest release is an immutable release. Turn on immutable releases in the repository settings before you publish it.',
                'Every file in the release has a build provenance attestation. Create it in the release workflow with actions/attest-build-provenance.',
                'The release has no exe or msi installers. Ship Windows builds as zip files.',
                'The release passes the automated checks. The Security page describes the checks.',
              ],
            },
            'Whether AI was used to develop a plugin does not affect listing. The same conditions apply to every plugin. Disclosing the use of AI is not required.',
            'This platform does not certify safety or quality by listing a plugin, so check plugins yourself before using them.',
          ],
        },
      ],
    },
    submit: {
      title: 'Submit a plugin',
      sections: [
        {
          heading: 'Build your plugin with Claude Code',
          paragraphs: [
            'If you build your plugin with Claude Code, you can install a skill that collects what the developer of this platform learned from making ten OBS Studio plugins. It covers planning, setting up the template, common pitfalls in the OBS API, headless render tests in CI, releases with build provenance attestations, and listing on this platform.',
            'Install it by running the following in a terminal:',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            'The skill follows the listing conditions and the review criteria of this platform: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: 'Plugins you can submit',
          paragraphs: [
            'This platform lists OBS Studio plugins whose author administers the GitHub repository and submits it. Check that your repository meets all of the following conditions before submitting.',
            {
              list: [
                'The repository is public on GitHub and is not archived.',
                'GitHub detects a license for the repository. Add a LICENSE file if GitHub shows no license.',
                'The CMakeLists.txt at the root of the repository references libobs, for example with find_package(libobs), and the repository contains C or C++ sources.',
                'The latest release on GitHub has the plugin files attached. GitHub records a SHA-256 digest for files uploaded to a release, and this platform uses that digest for checks.',
                'The latest release is an immutable release. Turn on immutable releases in the repository settings before you publish it.',
                'Every file in the release has a build provenance attestation. Create it in the release workflow with actions/attest-build-provenance.',
                'The release has no exe or msi installers. Ship Windows builds as zip files.',
              ],
            },
          ],
        },
        {
          heading: 'How to submit',
          paragraphs: [
            'Connect your MCP client to {{ORIGIN}}/mcp. In Claude Code, run:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'Sign in with your GitHub account from the MCP client. In Claude Code, run /mcp and choose plugin-soko-kun. In Codex, connect with codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp, then sign in with codex mcp login plugin-soko-kun. This platform itself never gets write access to your GitHub repositories.',
            'Ask the AI agent to submit your repository, for example: "Register the OBS plugin in https://github.com/<owner>/<repository>". You can also tell the agent the category, such as audio filter or dock.',
          ],
        },
        {
          heading: 'After submitting',
          paragraphs: [
            'This platform registers the plugin as waiting for checks. Until a release passes the checks, the plugin does not appear in search or on its own page.',
            'Checks run every 15 minutes and usually finish within a few hours.',
            'This platform lists only releases that pass the checks. When you publish a new release on GitHub, this platform picks it up and checks it automatically. You do not need to submit it again.',
            'To see the results, ask your AI agent to check your plugin with list_my_plugins, for example: "Check whether my plugin\'s new release is listed". The agent shows the state of each release, the reasons a release is not listed, the review findings, and how to fix them.',
            'Before you publish a release, ask the agent to run submit_plugin in check mode. It checks the listing conditions on the latest release and reviews the latest commit of the default branch. It does not register the plugin. You can use check mode up to 5 times in 24 hours.',
            'Some releases wait for an administrator to confirm them. To explain the changes in such a release, open an issue in the repository of this platform: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'When a submission is refused',
          paragraphs: [
            'The AI agent shows the reason code and how to fix it. Fix the cause and submit again.',
            {
              list: [
                'not_admin: You do not have admin permission on the repository. Ask an administrator of the repository to submit it.',
                'private_repository, archived_repository: Make the repository public, or unarchive it.',
                'no_license: Add a LICENSE file that GitHub can detect.',
                'not_obs_plugin: Make the root CMakeLists.txt reference libobs.',
                'no_release, no_verifiable_asset: Publish a release with the plugin files attached.',
                'duplicate: The repository is already registered. Open its page from the search.',
                'rate_limited: You can submit up to 10 times in 24 hours. Try again later.',
                'invalid_url: Give the repository URL in the form https://github.com/<owner>/<repository>.',
                'not_found: The repository was not found. Check the URL and that the repository is public.',
                'unsupported_tag: Use a release tag with only letters, digits, ".", "-", and "_", up to 100 characters.',
                'github_unavailable: GitHub did not respond normally. Try again later.',
                'not_immutable: Turn on immutable releases in the repository settings, then publish a new release.',
                'installer_not_allowed: Remove the exe and msi files. Ship Windows builds as zip files, then publish a new release.',
                'no_attestation: Add actions/attest-build-provenance to the release workflow so that every file has an attestation, then publish a new release.',
              ],
            },
          ],
        },
        {
          heading: 'Logo and description image',
          paragraphs: [
            'Authors can show one logo and one description image. Place the images in the .soko-kun folder of the repository.',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                'Logo: name the file logo. Keep it within 256 KB and 1,024 px on each side.',
                'Description image: name the file image. Keep it within 1.5 MB and 4,096 px on each side. GIF images play as animations.',
              ],
            },
            'This platform does not accept SVG, which can contain scripts, so use the extension png, jpg, jpeg, gif, or webp.',
            'This platform takes the images at the tag of the latest release, so publish a new release after you change an image.',
            'This platform does not show images that do not meet these conditions, so check the conditions if an image does not appear.',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            'Authors can declare the display name and the supported OS in .soko-kun/config.json. Place the file in the same .soko-kun folder as the images.',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name: The display name, from 1 to 60 characters. Without it, this platform shows the repository name.',
                'os: An array of windows, macos, and linux. With it, this platform lists only the files for the declared OS. Without it, this platform guesses the OS from the file names.',
              ],
            },
            'Both fields are optional.',
            'This platform reads the file at the tag of each new release, so publish a new release after you change the file.',
            'This platform does not list a release whose file is invalid, or that has no files for the declared OS.',
          ],
        },
        {
          heading: 'Updating and withdrawing',
          paragraphs: [
            'To update a listing, publish a new release on GitHub. This platform picks it up automatically and lists it after it passes the checks. This platform also updates the summary from the repository description.',
            'If a new release is not listed, ask your AI agent to check it with list_my_plugins. The agent shows the reason and how to fix it.',
            'To withdraw a listing, make the repository private or delete it, or send a request as described on the Report page.',
          ],
        },
        {
          id: 'rename',
          heading: 'Renaming or transferring the repository',
          paragraphs: [
            'This platform follows the repository by its GitHub ID, so you do not need to do anything when you rename the repository. The listing moves to the new name within 15 minutes, and links to the old name redirect to the new one.',
            'Do not create another repository with the old name. This platform keeps the old name for the renamed plugin and does not register another repository under it.',
            'If you transfer the repository to another account or organization, the listed release stays listed, and an administrator reviews the next release before listing it.',
            'To change the display name, change name in .soko-kun/config.json and publish a new release.',
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
            'This platform checks every new release before listing it. It lists only releases that pass the checks.',
            {
              list: [
                'Provenance: Every file must have a build provenance attestation. A GitHub Actions workflow verifies its signature. The workflow also confirms that the attestation matches the repository, the release tag, the commit of the tag, and the release workflow recorded for the plugin.',
                'Immutable release: The release must be immutable. Files in an immutable release cannot be replaced after it is published.',
                'Malware lookup: The SHA-256 digest of each file, as published by GitHub, is looked up in MalwareBazaar, a database of known malware samples. Listed files are looked up again regularly.',
                'Changes since the listed release: The changes from the listed release to the new release are checked against rules. A release that matches a rule waits for an administrator to confirm it.',
                'Development practice review: Items that the repository files decide, such as pinned actions and build flags, are checked by rules. Only the items that need reading text, such as install instructions in the README, are judged by an LLM, with facts computed by the catalog. The review does not read the source code. The criteria are based on concerns and recommendations that an OBS plugin developer has published. A release with a serious finding waits for an administrator to confirm it.',
              ],
            },
            'The review criteria are public on GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            'Releases that have not passed the checks are not shown. Until a new release passes, the previously listed release stays listed.',
            'A file reported as malicious suspends the plugin. An administrator can also suspend a release.',
            'Suspended releases are announced on the notices page {{ORIGIN}}/notices with the version, the SHA-256 of each file, and the period they were listed here. The plugin page also shows a warning.',
          ],
        },
        {
          heading: 'Limits of the checks',
          paragraphs: [
            'The malware lookup detects only threats already known to MalwareBazaar. New or targeted malware may not be detected, so use plugins carefully even when nothing is detected.',
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
            'Report incorrect information or policy issues as an issue in the GitHub repository: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'Private reports',
          paragraphs: [
            'Report suspected malware or security problems privately through GitHub private vulnerability reporting: https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            'Reports are reviewed by a person. A report alone does not suspend a listing. When a clear danger is confirmed, the listing is suspended and stays suspended even if the repository changes.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: ['Send other inquiries to the developer contact shown by the button below.', { contact: true }],
        },
      ],
    },
    terms: {
      title: 'Terms of use',
      sections: [
        {
          heading: 'Scope',
          paragraphs: [
            'Established: November 9, 2026',
            'These terms apply to everyone who uses the website and the MCP endpoint of Plugin Soko-kun (this platform), so use this platform only after agreeing to these terms.',
            'The Japanese version of these terms is authoritative, and other language versions are reference translations.',
          ],
        },
        {
          heading: 'What this platform provides',
          paragraphs: [
            'This platform collects information about OBS Studio plugins from GitHub, lists it, and guides users to files that authors published on GitHub.',
            'This platform does not host files and does not guarantee the safety, quality, or behavior of plugins, so check plugins yourself before using them.',
          ],
        },
        {
          heading: 'Obligations of authors who submit plugins',
          paragraphs: [
            'Authors who submit plugins must follow these rules.',
            {
              list: [
                'Submit only repositories that you administer.',
                'Do not list false information.',
                'Do not distribute malware or programs that harm users.',
                'Do not infringe the rights of others.',
              ],
            },
          ],
        },
        {
          heading: 'Prohibited acts',
          paragraphs: [
            'Do not do any of the following.',
            {
              list: [
                'Disrupt the operation of this platform with mass submissions or requests.',
                'Access the platform without authorization or exploit vulnerabilities.',
                'Interfere with other users or the operator.',
                'Violate laws or regulations.',
              ],
            },
          ],
        },
        {
          heading: 'Suspension and removal of listings',
          paragraphs: [
            'The operator may suspend or remove a listing without prior notice when the operator confirms a violation of these terms or a danger to users.',
          ],
        },
        {
          heading: 'Disclaimer',
          paragraphs: [
            'The operator is not liable for damages arising from the use of this platform or the installation of plugins, except in cases of the operator’s intent or gross negligence.',
            'The operator may change the contents of this platform, or suspend or end it, without notice.',
          ],
        },
        {
          heading: 'Changes to these terms',
          paragraphs: [
            'The operator changes these terms as needed and posts the changed terms and their effective date on this page, so check this page regularly.',
          ],
        },
        {
          heading: 'Governing law and jurisdiction',
          paragraphs: [
            'These terms are governed by the laws of Japan.',
            'The district court having jurisdiction over the operator’s address is the exclusive court of first instance for disputes about these terms or this platform.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'Send questions about these terms to the developer contact shown by the button below.',
            { contact: true },
          ],
        },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      sections: [
        {
          heading: 'Privacy policy',
          paragraphs: [
            'The Japanese version of this privacy policy is authoritative, and other language versions are reference translations.',
          ],
        },
        {
          heading: 'What is stored',
          paragraphs: [
            'When you sign in to submit a plugin, the service stores your GitHub user ID and login name, and the GitHub access token needed to check your repository permissions, together with the refresh token used to renew it. The tokens are stored encrypted and are used only to check permissions on the repositories you submit.',
            'To limit abuse, the service stores a one-way hash of your IP address for a short time. Browsing the catalog does not require cookies, except one that remembers your language choice.',
          ],
        },
        {
          heading: 'Your choices',
          paragraphs: [
            'You can revoke access at any time in GitHub settings under Applications. To ask for deletion of your data, open a private report as described on the Report page.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: ['Send other inquiries to the developer contact shown by the button below.', { contact: true }],
        },
      ],
    },
  },
  ja: {
    about: {
      title: '配信プラグイン倉庫くんとは？',
      sections: [
        {
          heading: 'このサービスについて',
          paragraphs: [
            '配信プラグイン倉庫くんは OBS Studio 向けのサードパーティ製プラグインを集めた、独立したオープンなレジストリです。このプラットフォームは OBS Project および OBS Forums と関係のない非公式のサービスです。',
            'このプラットフォームは配布物を保管しません。このプラットフォームは公開されている GitHub リポジトリの情報を記録し、作者が GitHub Releases で公開した配布物へ案内します。',
            'このプラットフォームは配布物を保管しないので、配布物は GitHub から直接ダウンロードしてください。',
          ],
        },
        {
          heading: 'AI エージェントから使う (MCP)',
          paragraphs: [
            'MCP クライアントをこのサイトの /mcp に接続してください。Claude Code では次を実行してください:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'Codex では次を実行してください:',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            '検索と詳細取得については、GitHub サインインなしで使えます。リポジトリを登録するときは、MCP クライアントから GitHub でサインインしてください (Claude Code では /mcp を、Codex では codex mcp login plugin-soko-kun を実行)。なおこのプラットフォーム自体が GitHub リポジトリへの書き込み権限を取得することはありません。',
            '話しかけ方の例:「Windows で動くピッチシフトのプラグインを探して」「この GitHub リポジトリの OBS プラグインを登録して」「自分のプラグインの新しいリリースの掲載の状態を確かめて」',
          ],
        },
        {
          heading: '開発の支援',
          paragraphs: [
            '配信プラグイン倉庫くんは無料で使えます。運営費と開発を支援していただける場合は、GitHub Sponsors で開発者を支援できます: https://github.com/sponsors/AllegroMoltoV',
            '支援は任意です。支援の有無は、プラグインの掲載と検査に影響しません。',
          ],
        },
      ],
    },
    policy: {
      title: '掲載ポリシー',
      sections: [
        {
          heading: '掲載ポリシー',
          paragraphs: [
            'このプラットフォームは、GitHub リポジトリの管理者である作者が登録し、次の条件をすべて満たしたプラグインを掲載します。',
            {
              list: [
                'リポジトリが GitHub で公開されていて、アーカイブされていないこと。',
                'GitHub がリポジトリのライセンスを検出できること。GitHub にライセンスが表示されないときは、LICENSE ファイルを追加してください。',
                'リポジトリの直下の CMakeLists.txt が find_package(libobs) などで libobs を参照していて、C または C++ のソースがあること。',
                'GitHub の最新のリリースに、プラグインの配布物が添付されていること。GitHub はリリースにアップロードした配布物に SHA-256 を記録し、このプラットフォームはその値で検査します。',
                '最新のリリースが不変のリリース (immutable release) であること。公開する前に、リポジトリの設定で不変のリリースを有効にしてください。',
                'リリースのすべての配布物に、build provenance の証明があること。リリースのワークフローで actions/attest-build-provenance を使って証明を作ってください。',
                '配布物に exe や msi のインストーラーが無いこと。Windows 向けの配布物は zip で配ってください。',
                'リリースが自動検査を通ること。検査の内容はセキュリティと免責のページに記載しています。',
              ],
            },
            '開発に AI を使ったかどうかは掲載に影響しません。このプラットフォームはすべてのプラグインに同じ条件を適用し、AI の使用の申告も求めません。',
            'このプラットフォームは掲載によって安全性や品質を認証しないので、各自で確かめてから利用してください。',
          ],
        },
      ],
    },
    submit: {
      title: 'プラグインを登録する',
      sections: [
        {
          heading: 'Claude Code でプラグインを作る',
          paragraphs: [
            'Claude Code でプラグインを作る場合は、このプラットフォームの開発者が 10 本の OBS Studio のプラグインを作って得た知見をまとめたスキルを入れられます。企画、テンプレートの準備、OBS の API の落とし穴、CI での画面なしの描画のテスト、ビルドの来歴の証明つきのリリース、このプラットフォームへの掲載を扱います。',
            'ターミナルで次を実行して入れてください。',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            'スキルは、このプラットフォームの掲載の条件と審査の基準にしたがっています: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: '登録できるプラグイン',
          paragraphs: [
            'このプラットフォームは、GitHub リポジトリの管理者である作者が登録した OBS Studio のプラグインを掲載します。登録する前に、リポジトリが次の条件をすべて満たすことを確認してください。',
            {
              list: [
                'リポジトリが GitHub で公開されていて、アーカイブされていないこと。',
                'GitHub がリポジトリのライセンスを検出できること。GitHub にライセンスが表示されないときは、LICENSE ファイルを追加してください。',
                'リポジトリの直下の CMakeLists.txt が find_package(libobs) などで libobs を参照していて、C または C++ のソースがあること。',
                'GitHub の最新のリリースに、プラグインの配布物が添付されていること。GitHub はリリースにアップロードした配布物に SHA-256 を記録し、このプラットフォームはその値で検査します。',
                '最新のリリースが不変のリリース (immutable release) であること。公開する前に、リポジトリの設定で不変のリリースを有効にしてください。',
                'リリースのすべての配布物に、build provenance の証明があること。リリースのワークフローで actions/attest-build-provenance を使って証明を作ってください。',
                '配布物に exe や msi のインストーラーが無いこと。Windows 向けの配布物は zip で配ってください。',
              ],
            },
          ],
        },
        {
          heading: '登録の手順',
          paragraphs: [
            'MCP クライアントを {{ORIGIN}}/mcp に接続してください。Claude Code では次を実行してください:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'MCP クライアントから GitHub のアカウントでサインインしてください。Claude Code では /mcp を実行し、plugin-soko-kun を選んでください。Codex では codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp で接続してから、codex mcp login plugin-soko-kun でサインインしてください。なおこのプラットフォーム自体が GitHub リポジトリへの書き込み権限を取得することはありません。',
            'AI エージェントに登録を頼んでください。話しかけ方の例は「https://github.com/<owner>/<repository> の OBS プラグインを登録して」です。音声フィルターやドックのように、カテゴリも伝えられます。',
          ],
        },
        {
          heading: '登録した後の流れ',
          paragraphs: [
            'このプラットフォームはプラグインを検査待ちで登録します。リリースが検査を通るまで、プラグインは検索とプラグインのページに表示されません。',
            '検査は 15 分ごとに進み、ふつう数時間以内に終わります。',
            'このプラットフォームは、検査を通った版だけを掲載します。GitHub で新しいリリースを公開すると、このプラットフォームは自動で取り込んで検査します。登録し直す必要はありません。',
            '検査の結果は、AI エージェントに list_my_plugins で確かめさせてください。話しかけ方の例は「自分のプラグインの新しいリリースの掲載の状態を確かめて」です。AI エージェントは、版ごとの状態・掲載していない理由・レビューの指摘・直し方を示します。',
            'リリースを公開する前に、AI エージェントに submit_plugin の確認のモードを使わせてください。確認のモードは、最新のリリースで掲載の条件を判定し、既定のブランチの最新のコミットをレビューします。このモードでは登録しません。確認のモードは 24 時間に 5 回まで使えます。',
            '管理者の確認待ちになる版もあります。その版の変更の意図を説明するときは、このプラットフォームのリポジトリの Issue に書いてください: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '登録が拒否されたとき',
          paragraphs: [
            'AI エージェントが理由のコードと直し方を表示するので、原因を直してから登録し直してください。',
            {
              list: [
                'not_admin: リポジトリの管理権限がありません。リポジトリの管理者に登録を頼んでください。',
                'private_repository、archived_repository: リポジトリを公開するか、アーカイブを解除してください。',
                'no_license: GitHub が検出できる LICENSE ファイルを追加してください。',
                'not_obs_plugin: 直下の CMakeLists.txt で libobs を参照してください。',
                'no_release、no_verifiable_asset: 配布物を添付したリリースを公開してください。',
                'duplicate: リポジトリは登録済みです。検索からプラグインのページを開いてください。',
                'rate_limited: 登録は 24 時間に 10 回までです。時間をおいてから登録してください。',
                'invalid_url: リポジトリの URL を https://github.com/<owner>/<repository> の形で指定してください。',
                'not_found: リポジトリが見つかりません。URL と、リポジトリが公開されていることを確認してください。',
                'unsupported_tag: リリースのタグは、英数字・「.」・「-」・「_」だけの 100 文字以内にしてください。',
                'github_unavailable: GitHub が正常に応答しませんでした。時間をおいてから登録してください。',
                'not_immutable: リポジトリの設定で不変のリリースを有効にしてから、新しいリリースを公開してください。',
                'installer_not_allowed: exe と msi の配布物を外してください。Windows 向けは zip で配り、新しいリリースを公開してください。',
                'no_attestation: リリースのワークフローに actions/attest-build-provenance を加え、すべての配布物に証明を付けてください。そのうえで新しいリリースを公開してください。',
              ],
            },
          ],
        },
        {
          heading: 'ロゴと説明の画像',
          paragraphs: [
            '作者は、ロゴと説明の画像を 1 枚ずつ掲載できます。リポジトリの .soko-kun フォルダーに画像を置いてください。',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                'ロゴ: ファイル名を logo にしてください。大きさは 256 KB 以内、縦と横は 1,024 px 以内にしてください。',
                '説明の画像: ファイル名を image にしてください。大きさは 1.5 MB 以内、縦と横は 4,096 px 以内にしてください。GIF はアニメーションとして再生されます。',
              ],
            },
            'このプラットフォームはスクリプトを含められる SVG を受け付けないので、拡張子は png、jpg、jpeg、gif、webp のいずれかにしてください。',
            'このプラットフォームは最新リリースのタグの時点の画像を取得するので、画像を変えたときは新しいリリースを公開してください。',
            'このプラットフォームは条件に合わない画像を掲載しないので、画像が表示されないときは条件を確認してください。',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            '作者は .soko-kun/config.json で、表示名と対応 OS を宣言できます。画像と同じ .soko-kun フォルダーにファイルを置いてください。',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name: 表示名です。1〜60 文字で書いてください。書かないときは、リポジトリ名を表示します。',
                'os: windows・macos・linux を配列で書きます。書くと、このプラットフォームは宣言した OS の配布物だけを掲載します。書かないときは、配布物のファイル名から OS を推定します。',
              ],
            },
            'どちらの項目も任意です。',
            'このプラットフォームは新しいリリースのタグの時点のファイルを読むので、ファイルを変えたときは新しいリリースを公開してください。',
            'ファイルの内容が条件に合わないリリースと、宣言した OS の配布物が無いリリースは掲載しません。',
          ],
        },
        {
          heading: '更新と掲載の取り下げ',
          paragraphs: [
            '掲載を更新するときは、GitHub で新しいリリースを公開してください。このプラットフォームは新しいリリースを自動で取り込み、検査を通ったら掲載します。リポジトリの説明から概要も更新します。',
            '新しいリリースが掲載されないときは、AI エージェントに list_my_plugins で理由を確かめさせてください。AI エージェントは理由と直し方を示します。',
            '掲載を取り下げるときは、リポジトリを非公開にするか削除してください。通報ページの方法で取り下げを依頼することもできます。',
          ],
        },
        {
          id: 'rename',
          heading: 'リポジトリの名前の変更と移管',
          paragraphs: [
            'このプラットフォームは GitHub のリポジトリの ID でリポジトリを追うので、リポジトリの名前を変えても作業は要りません。掲載は 15 分以内に新しい名前へ移り、旧い名前へのリンクは新しい名前へ転送されます。',
            '旧い名前で別のリポジトリを作らないでください。旧い名前は、名前を変えたプラグインのためにこのプラットフォームが取っておき、その名前では別のリポジトリを登録しません。',
            'リポジトリを別のアカウントや組織へ移管すると、掲載中のリリースはそのまま掲載し、次のリリースは管理者が確かめてから掲載します。',
            '表示名を変えるときは、.soko-kun/config.json の name を変えて新しいリリースを公開してください。',
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
            'このプラットフォームは、新しいリリースを掲載する前に検査します。検査を通ったリリースだけを掲載します。',
            {
              list: [
                '証明の照合: すべての配布物に build provenance の証明が必要です。GitHub Actions のワークフローが、証明の署名を検証します。あわせて、証明がリポジトリ・リリースのタグ・タグのコミット・記録したリリースのワークフローと一致することを確かめます。',
                '不変のリリース: リリースが不変であることを確かめます。不変のリリースでは、公開した後に配布物を差し替えられません。',
                'マルウェアの照会: GitHub が公開する配布物の SHA-256 を、既知のマルウェアのデータベースである MalwareBazaar で照会します。掲載中の配布物も定期的に照会し直します。',
                '新しい版の差分: 掲載中のリリースから新しいリリースまでの変更を、ルールで検査します。ルールに当たったリリースは、管理者の確認待ちにします。',
                '開発の実践のレビュー: アクションの固定やビルドの設定のように、リポジトリのファイルで決まる項目はルールで判定します。README の導入の手順のように、文章を読む必要がある項目だけを、倉庫くんが計算した事実とともに LLM が判定します。ソースのコードは読みません。基準は、OBS のプラグインの開発者が公開物で述べている懸念と推奨にもとづきます。重大な指摘があるリリースは、管理者の確認待ちにします。',
              ],
            },
            'レビューの基準は GitHub で公開しています: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            '検査を通っていないリリースは表示しません。新しいリリースが検査を通るまでは、前に掲載していたリリースを掲載し続けます。',
            'マルウェアと判定された配布物があると、このプラットフォームはプラグインの掲載を停止します。管理者がリリースを止めることもあります。',
            '止めたリリースは、告知ページ {{ORIGIN}}/notices で、版・配布物の SHA-256・掲載していた期間とともに知らせます。プラグインのページにも警告を表示します。',
          ],
        },
        {
          heading: '検査の限界',
          paragraphs: [
            'マルウェアの照会で検出できるのは、MalwareBazaar に既に知られている脅威だけです。新しいマルウェアや標的型のマルウェアは検出できないことがあるので、検査で何も検出されなくても、注意して利用してください。',
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
            '誤った情報や掲載ポリシーに関する問題は、GitHub リポジトリの Issues で報告してください: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '非公開の通報',
          paragraphs: [
            'マルウェアの疑いやセキュリティの問題は、GitHub の Private vulnerability reporting で非公開に通報してください: https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            '管理者は通報を確認してから対応を決めます。このプラットフォームは通報だけでは掲載を停止しません。管理者が明確な危険を確認した場合は掲載を停止し、リポジトリが更新されても停止を続けます。',
          ],
        },
        {
          heading: '連絡先',
          paragraphs: [
            'そのほかの問い合わせは、下のボタンで表示する開発者の連絡先へ送ってください。',
            { contact: true },
          ],
        },
      ],
    },
    terms: {
      title: '利用規約',
      sections: [
        {
          heading: '適用',
          paragraphs: [
            '制定日: 2026 年 11 月 9 日',
            'この利用規約は、配信プラグイン倉庫くん (以下、このプラットフォーム) の Web サイトと MCP エンドポイントを利用するすべての人に適用するので、利用者はこの規約に同意したうえで利用してください。',
            'この規約は日本語版を正とし、ほかの言語版は参考訳です。',
          ],
        },
        {
          heading: 'このプラットフォームが提供するもの',
          paragraphs: [
            'このプラットフォームは、OBS Studio 向けプラグインの情報を GitHub から集めて掲載し、作者が GitHub で公開した配布物へ案内します。',
            'このプラットフォームは配布物を保管せず、プラグインの安全性、品質、動作を保証しないので、利用者は各自の責任で確かめてから利用してください。',
          ],
        },
        {
          heading: '登録する作者が守ること',
          paragraphs: [
            'プラグインを登録する作者は、次のことを守ってください。',
            {
              list: [
                '自分が管理権限を持つリポジトリだけを登録すること。',
                '虚偽の情報を掲載しないこと。',
                'マルウェアや、利用者に害を与えるプログラムを配布しないこと。',
                '第三者の権利を侵害しないこと。',
              ],
            },
          ],
        },
        {
          heading: '禁止する行為',
          paragraphs: [
            '利用者は、次の行為をしないでください。',
            {
              list: [
                '大量の登録や要求で、このプラットフォームの運営を妨げること。',
                '不正アクセスや、脆弱性を悪用すること。',
                'ほかの利用者や運営者を妨害すること。',
                '法令に違反すること。',
              ],
            },
          ],
        },
        {
          heading: '掲載の停止と削除',
          paragraphs: [
            '運営者は、この規約への違反や利用者への危険を確認した場合、事前に通知せずに掲載を停止または削除できます。',
          ],
        },
        {
          heading: '免責',
          paragraphs: [
            '運営者は、このプラットフォームの利用やプラグインの導入によって生じた損害について、運営者の故意または重大な過失による場合を除き、責任を負いません。',
            '運営者は、予告なくこのプラットフォームの内容を変更し、提供を中断または終了することがあります。',
          ],
        },
        {
          heading: '規約の変更',
          paragraphs: [
            '運営者は、必要に応じてこの規約を変更し、変更後の規約と効力が生じる日をこのページに掲載するので、利用者は定期的にこのページを確認してください。',
          ],
        },
        {
          heading: '準拠法と管轄',
          paragraphs: [
            'この規約は日本法に準拠します。',
            'この規約やこのプラットフォームに関する紛争は、運営者の住所地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。',
          ],
        },
        {
          heading: '連絡先',
          paragraphs: [
            'この規約についての問い合わせは、下のボタンで表示する開発者の連絡先へ送ってください。',
            { contact: true },
          ],
        },
      ],
    },
    privacy: {
      title: 'プライバシーポリシー',
      sections: [
        {
          heading: 'プライバシーポリシー',
          paragraphs: ['このプライバシーポリシーは日本語版を正とし、ほかの言語版は参考訳です。'],
        },
        {
          heading: '保存する情報',
          paragraphs: [
            'プラグインを登録するためにサインインすると、このプラットフォームは GitHub のユーザー ID とログイン名と、リポジトリの権限の確認に使う GitHub のアクセストークンと、その更新に使うリフレッシュトークンを保存します。このプラットフォームはトークンを暗号化して保存し、登録したリポジトリの権限の確認にだけ使います。',
            'このプラットフォームは乱用を防ぐため、IP アドレスを一方向のハッシュにして短期間保存します。カタログの閲覧では、選んだ言語を覚える cookie のほかは使いません。',
          ],
        },
        {
          heading: '利用者ができること',
          paragraphs: [
            'GitHub の設定の Applications から、いつでもアクセスを取り消せます。データの削除を求めるときは、通報ページの方法で非公開の通報を送ってください。',
          ],
        },
        {
          heading: '連絡先',
          paragraphs: [
            'そのほかの問い合わせは、下のボタンで表示する開発者の連絡先へ送ってください。',
            { contact: true },
          ],
        },
      ],
    },
  },
  'zh-Hans': {
    about: {
      title: '什么是配信プラグイン倉庫くん？',
      sections: [
        {
          heading: '关于本服务',
          paragraphs: [
            '配信プラグイン倉庫くん（Plugin Soko-kun）是一个独立、开放的 OBS Studio 第三方插件收录服务。本服务是与 OBS Project 及 OBS Forums 无关的非官方服务。',
            '本服务不保存文件。它记录公开 GitHub 仓库的信息，并引导用户前往作者在 GitHub Releases 发布的文件。',
            '本平台不保存文件，请直接从 GitHub 下载文件。',
          ],
        },
        {
          heading: '通过 AI 代理使用（MCP）',
          paragraphs: [
            '将 MCP 客户端连接到本站的 /mcp。在 Claude Code 中运行：',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            '在 Codex 中运行：',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            '搜索和查看详情无需登录 GitHub。提交仓库时，请在 MCP 客户端中使用 GitHub 登录（在 Claude Code 中运行 /mcp，在 Codex 中运行 codex mcp login plugin-soko-kun）。本平台本身不会获得 GitHub 仓库的写入权限。',
            '示例：“帮我找一个能在 Windows 上使用的变调插件”“把这个 GitHub 仓库的 OBS 插件登记上去”“确认我的插件的新版本是否已收录”',
          ],
        },
        {
          heading: '支持开发',
          paragraphs: [
            '配信プラグイン倉庫くん可以免费使用。如果您愿意支持运营费用和开发，可以通过 GitHub Sponsors 赞助开发者：https://github.com/sponsors/AllegroMoltoV',
            '赞助完全自愿，不会影响插件的收录和检查。',
          ],
        },
      ],
    },
    policy: {
      title: '收录政策',
      sections: [
        {
          heading: '收录政策',
          paragraphs: [
            '本平台收录由 GitHub 仓库管理员本人提交、并满足以下全部条件的插件。',
            {
              list: [
                '仓库在 GitHub 上公开，且未归档。',
                'GitHub 能检测到仓库的许可证。如果 GitHub 未显示许可证，请添加 LICENSE 文件。',
                '仓库根目录的 CMakeLists.txt 通过 find_package(libobs) 等方式引用 libobs，且仓库包含 C 或 C++ 源代码。',
                'GitHub 上的最新发布附有插件文件。GitHub 会为上传到发布中的文件记录 SHA-256，本平台使用该值进行检查。',
                '最新发布是不可变发布（immutable release）。发布前，请在仓库设置中启用不可变发布。',
                '发布中的每个文件都有构建来源证明（build provenance attestation）。请在发布工作流中使用 actions/attest-build-provenance 生成证明。',
                '发布中没有 exe 或 msi 安装程序。Windows 版本请以 zip 文件分发。',
                '发布通过自动检查。检查内容见“安全与免责声明”页面。',
              ],
            },
            '是否使用 AI 开发不影响收录。所有插件适用相同条件，也不要求申报 AI 的使用。',
            '本平台不会因收录而认证安全性或质量，请自行确认后再使用。',
          ],
        },
      ],
    },
    submit: {
      title: '提交插件',
      sections: [
        {
          heading: '使用 Claude Code 制作插件',
          paragraphs: [
            '如果使用 Claude Code 制作插件，可以安装一个技能。它汇集了本平台开发者制作 10 个 OBS Studio 插件时获得的经验，涵盖规划、模板准备、OBS API 的常见陷阱、CI 中的无界面渲染测试、带构建来源证明的发布，以及在本平台上架。',
            '在终端中运行以下命令进行安装：',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            '该技能遵循本平台的收录条件和审查标准：https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: '可以提交的插件',
          paragraphs: [
            '本平台收录由 GitHub 仓库管理员本人提交的 OBS Studio 插件。提交前，请确认仓库满足以下全部条件。',
            {
              list: [
                '仓库在 GitHub 上公开，且未归档。',
                'GitHub 能检测到仓库的许可证。如果 GitHub 未显示许可证，请添加 LICENSE 文件。',
                '仓库根目录的 CMakeLists.txt 通过 find_package(libobs) 等方式引用 libobs，且仓库包含 C 或 C++ 源代码。',
                'GitHub 上的最新发布附有插件文件。GitHub 会为上传到发布中的文件记录 SHA-256，本平台使用该值进行检查。',
                '最新发布是不可变发布（immutable release）。发布前，请在仓库设置中启用不可变发布。',
                '发布中的每个文件都有构建来源证明（build provenance attestation）。请在发布工作流中使用 actions/attest-build-provenance 生成证明。',
                '发布中没有 exe 或 msi 安装程序。Windows 版本请以 zip 文件分发。',
              ],
            },
          ],
        },
        {
          heading: '提交步骤',
          paragraphs: [
            '请将 MCP 客户端连接到 {{ORIGIN}}/mcp。在 Claude Code 中请运行：',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            '请在 MCP 客户端中使用 GitHub 账号登录。在 Claude Code 中请运行 /mcp 并选择 plugin-soko-kun。在 Codex 中请先用 codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp 连接，再用 codex mcp login plugin-soko-kun 登录。本平台本身不会获得 GitHub 仓库的写入权限。',
            '请让 AI 代理帮您提交，例如：“把 https://github.com/<owner>/<repository> 的 OBS 插件登记上去”。您也可以告诉代理分类，例如音频滤镜或停靠窗口。',
          ],
        },
        {
          heading: '提交之后',
          paragraphs: [
            '本平台将插件登记为等待检查。在某个发布通过检查之前，插件不会出现在搜索结果中，也没有插件页面。',
            '检查每 15 分钟进行一次，通常在几小时内完成。',
            '本平台只收录通过检查的发布。您在 GitHub 上发布新版本后，本平台会自动获取并检查它。无需重新提交。',
            '要查看检查结果，请让 AI 代理用 list_my_plugins 确认您的插件，例如：“确认我的插件的新版本是否已收录”。代理会显示每个发布的状态、未收录的原因、审查意见以及修改方法。',
            '发布之前，请让代理以检查模式运行 submit_plugin。检查模式会用最新发布判断收录条件，并审查默认分支的最新提交。检查模式不会登记插件。24 小时内最多可使用 5 次检查模式。',
            '有些发布需要等待管理员确认。如需说明此类发布中的变更，请在本平台的仓库中提交 Issue：https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '提交被拒绝时',
          paragraphs: [
            'AI 代理会显示原因代码和修改方法，请修正原因后重新提交。',
            {
              list: [
                'not_admin：您没有该仓库的管理权限。请让仓库管理员提交。',
                'private_repository、archived_repository：请公开仓库或取消归档。',
                'no_license：请添加 GitHub 能检测到的 LICENSE 文件。',
                'not_obs_plugin：请在根目录的 CMakeLists.txt 中引用 libobs。',
                'no_release、no_verifiable_asset：请发布附有插件文件的版本。',
                'duplicate：该仓库已登记。请通过搜索打开插件页面。',
                'rate_limited：24 小时内最多提交 10 次。请稍后再试。',
                'invalid_url：请以 https://github.com/<owner>/<repository> 的形式指定仓库 URL。',
                'not_found：找不到该仓库。请确认 URL 以及仓库是否公开。',
                'unsupported_tag：发布标签只能使用字母、数字、“.”、“-”和“_”，且不超过 100 个字符。',
                'github_unavailable：GitHub 未正常响应。请稍后再提交。',
                'not_immutable：请在仓库设置中启用不可变发布，然后发布新版本。',
                'installer_not_allowed：请移除 exe 和 msi 文件。Windows 版本请以 zip 文件分发，然后发布新版本。',
                'no_attestation：请在发布工作流中加入 actions/attest-build-provenance，为每个文件生成证明，然后发布新版本。',
              ],
            },
          ],
        },
        {
          heading: '徽标与说明图片',
          paragraphs: [
            '作者可以各展示一张徽标和说明图片。请将图片放在仓库的 .soko-kun 文件夹中。',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                '徽标：文件名为 logo。请将大小控制在 256 KB 以内，长和宽控制在 1,024 px 以内。',
                '说明图片：文件名为 image。请将大小控制在 1.5 MB 以内，长和宽控制在 4,096 px 以内。GIF 会以动画形式播放。',
              ],
            },
            '本平台不接受可包含脚本的 SVG，因此请使用 png、jpg、jpeg、gif 或 webp 扩展名。',
            '本平台获取最新发布版本标签时的图片，因此更改图片后请发布新的版本。',
            '本平台不显示不符合条件的图片，因此如果图片未显示，请检查条件。',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            '作者可以在 .soko-kun/config.json 中声明显示名称和支持的操作系统。请将该文件放在与图片相同的 .soko-kun 文件夹中。',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name：显示名称，1 到 60 个字符。未填写时，本平台显示仓库名称。',
                'os：由 windows、macos、linux 组成的数组。填写后，本平台只收录所声明操作系统的文件。未填写时，本平台根据文件名推断操作系统。',
              ],
            },
            '两个字段都是可选的。',
            '本平台读取每个新发布标签时的该文件，因此更改文件后请发布新的版本。',
            '如果文件内容不符合条件，或没有所声明操作系统的文件，本平台不会收录该发布。',
          ],
        },
        {
          heading: '更新与撤下',
          paragraphs: [
            '更新收录内容时，请在 GitHub 上发布新版本。本平台会自动获取新版本，并在通过检查后收录。本平台也会根据仓库说明更新简介。',
            '如果新版本未被收录，请让 AI 代理用 list_my_plugins 确认。代理会显示原因和修改方法。',
            '撤下收录时，请将仓库设为私有或删除仓库。您也可以按举报页面的方法申请撤下。',
          ],
        },
        {
          id: 'rename',
          heading: '重命名或转移仓库',
          paragraphs: [
            '本平台通过 GitHub 的仓库 ID 跟踪仓库，因此重命名仓库时无需任何操作。收录会在 15 分钟内转到新名称，指向旧名称的链接会重定向到新名称。',
            '请不要用旧名称创建另一个仓库。本平台会为已重命名的插件保留旧名称，不会以该名称收录其他仓库。',
            '如果将仓库转移到其他账号或组织，已收录的版本会继续收录，下一个版本由管理员确认后再收录。',
            '要更改显示名称，请修改 .soko-kun/config.json 中的 name 并发布新版本。',
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
            '本平台在收录每个新发布之前都会进行检查，只收录通过检查的发布。',
            {
              list: [
                '来源证明：每个文件都必须有构建来源证明。GitHub Actions 工作流会验证其签名，并确认证明与仓库、发布标签、标签的提交以及为该插件记录的发布工作流一致。',
                '不可变发布：发布必须是不可变的。不可变发布中的文件在发布后无法替换。',
                '恶意软件查询：在已知恶意软件数据库 MalwareBazaar 中查询 GitHub 公布的每个文件的 SHA-256。已收录的文件也会定期重新查询。',
                '与已收录发布的差异：按规则检查从已收录发布到新发布的变更。符合规则的发布将等待管理员确认。',
                '开发实践审查：由仓库文件即可判定的项目（例如 Action 的固定和构建设置）按规则判定。只有需要阅读文字的项目（例如 README 中的安装步骤）才由 LLM 结合本服务计算的事实进行判定。不读取源代码。审查标准基于一位 OBS 插件开发者公开发表的担忧与建议。有严重问题的发布将等待管理员确认。',
              ],
            },
            '审查标准在 GitHub 上公开：https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            '未通过检查的发布不会显示。在新发布通过检查之前，之前收录的发布将继续收录。',
            '如有文件被判定为恶意软件，将暂停该插件的收录。管理员也可能暂停某个发布。',
            '被暂停的发布会在公告页面 {{ORIGIN}}/notices 上公布，并附上版本、每个文件的 SHA-256 以及在本平台收录的期间。插件页面也会显示警告。',
          ],
        },
        {
          heading: '检查的局限',
          paragraphs: [
            '恶意软件查询只能检出 MalwareBazaar 中已知的威胁。新型或定向的恶意软件可能无法检出，因此即使未检出任何问题，也请谨慎使用。',
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
          paragraphs: [
            '错误信息或收录政策相关问题，请在 GitHub 仓库的 Issues 中提交：https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '非公开举报',
          paragraphs: [
            '疑似恶意软件或安全问题，请通过 GitHub 的 Private vulnerability reporting 非公开举报：https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            '举报由人工确认。仅凭举报不会暂停收录。确认存在明确危险时将暂停收录，即使仓库更新也会继续暂停。',
          ],
        },
        { heading: '联系方式', paragraphs: ['其他咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }] },
      ],
    },
    terms: {
      title: '使用条款',
      sections: [
        {
          heading: '适用范围',
          paragraphs: [
            '制定日期：2026 年 11 月 9 日',
            '本条款适用于所有使用配信プラグイン倉庫くん（以下称本平台）网站和 MCP 端点的人，请在同意本条款后使用本平台。',
            '本条款以日文版为准，其他语言版本仅供参考。',
          ],
        },
        {
          heading: '本平台提供的内容',
          paragraphs: [
            '本平台从 GitHub 收集并收录 OBS Studio 插件的信息，并引导用户前往作者在 GitHub 上发布的文件。',
            '本平台不保存文件，也不保证插件的安全性、质量和运行，请用户自行确认后再使用。',
          ],
        },
        {
          heading: '提交插件的作者须遵守的事项',
          paragraphs: [
            '提交插件的作者请遵守以下事项。',
            {
              list: [
                '只提交自己拥有管理权限的仓库。',
                '不发布虚假信息。',
                '不分发恶意软件或会伤害用户的程序。',
                '不侵犯第三方的权利。',
              ],
            },
          ],
        },
        {
          heading: '禁止行为',
          paragraphs: [
            '用户请勿进行以下行为。',
            {
              list: [
                '以大量提交或请求妨碍本平台的运营。',
                '进行未经授权的访问或利用漏洞。',
                '妨碍其他用户或运营者。',
                '违反法律法规。',
              ],
            },
          ],
        },
        {
          heading: '收录的暂停与删除',
          paragraphs: ['运营者确认违反本条款或对用户存在危险时，可以不经事先通知暂停或删除收录。'],
        },
        {
          heading: '免责',
          paragraphs: [
            '对于因使用本平台或安装插件而产生的损害，除运营者故意或重大过失的情形外，运营者不承担责任。',
            '运营者可能在不预先通知的情况下变更本平台的内容，或中断、终止提供。',
          ],
        },
        {
          heading: '条款的变更',
          paragraphs: ['运营者会根据需要变更本条款，并在本页面公布变更后的条款及生效日期，请用户定期查看本页面。'],
        },
        {
          heading: '准据法与管辖',
          paragraphs: [
            '本条款以日本法律为准据法。',
            '与本条款或本平台有关的纠纷，以管辖运营者住所地的地方法院为第一审专属协议管辖法院。',
          ],
        },
        {
          heading: '联系方式',
          paragraphs: ['关于本条款的咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }],
        },
      ],
    },
    privacy: {
      title: '隐私政策',
      sections: [
        { heading: '隐私政策', paragraphs: ['本隐私政策以日文版为准，其他语言版本仅供参考。'] },
        {
          heading: '保存的信息',
          paragraphs: [
            '为提交插件而登录时，本服务会保存您的 GitHub 用户 ID 和登录名，以及用于确认仓库权限的 GitHub 访问令牌和用于更新该令牌的刷新令牌。令牌加密保存，仅用于确认您所提交仓库的权限。',
            '为防止滥用，本服务会将 IP 地址进行单向哈希后短期保存。浏览目录时，除记住语言选择的 cookie 外不使用其他 cookie。',
          ],
        },
        {
          heading: '您可以做的事',
          paragraphs: [
            '您可以随时在 GitHub 设置的 Applications 中撤销访问权限。如需删除数据，请按举报页面的方法提交非公开举报。',
          ],
        },
        { heading: '联系方式', paragraphs: ['其他咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }] },
      ],
    },
  },
  'zh-Hant': {
    about: {
      title: '什麼是配信プラグイン倉庫くん？',
      sections: [
        {
          heading: '關於本服務',
          paragraphs: [
            '配信プラグイン倉庫くん（Plugin Soko-kun）是一個獨立、開放的 OBS Studio 第三方外掛收錄服務。本服務是與 OBS Project 及 OBS Forums 無關的非官方服務。',
            '本服務不保存檔案。它記錄公開 GitHub 儲存庫的資訊，並引導使用者前往作者在 GitHub Releases 發布的檔案。',
            '本平台不保存檔案，請直接從 GitHub 下載檔案。',
          ],
        },
        {
          heading: '透過 AI 代理使用（MCP）',
          paragraphs: [
            '將 MCP 用戶端連接到本站的 /mcp。在 Claude Code 中執行：',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            '在 Codex 中執行：',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            '搜尋與查看詳情無需登入 GitHub。提交儲存庫時，請在 MCP 用戶端中以 GitHub 登入（在 Claude Code 中執行 /mcp，在 Codex 中執行 codex mcp login plugin-soko-kun）。本平台本身不會取得 GitHub 儲存庫的寫入權限。',
            '範例：「幫我找一個能在 Windows 上使用的變調外掛」「把這個 GitHub 儲存庫的 OBS 外掛登記上去」「確認我的外掛的新版本是否已收錄」',
          ],
        },
        {
          heading: '支持開發',
          paragraphs: [
            '配信プラグイン倉庫くん可以免費使用。如果您願意支持營運費用和開發，可以透過 GitHub Sponsors 贊助開發者：https://github.com/sponsors/AllegroMoltoV',
            '贊助完全自願，不會影響外掛的收錄和檢查。',
          ],
        },
      ],
    },
    policy: {
      title: '收錄政策',
      sections: [
        {
          heading: '收錄政策',
          paragraphs: [
            '本平台收錄由 GitHub 儲存庫管理員本人提交、並滿足以下全部條件的外掛。',
            {
              list: [
                '儲存庫在 GitHub 上公開，且未封存。',
                'GitHub 能偵測到儲存庫的授權。如果 GitHub 未顯示授權，請新增 LICENSE 檔案。',
                '儲存庫根目錄的 CMakeLists.txt 透過 find_package(libobs) 等方式參照 libobs，且儲存庫包含 C 或 C++ 原始碼。',
                'GitHub 上的最新發行附有外掛檔案。GitHub 會為上傳到發行中的檔案記錄 SHA-256，本平台使用該值進行檢查。',
                '最新發行是不可變發行（immutable release）。發布前，請在儲存庫設定中啟用不可變發行。',
                '發行中的每個檔案都有建置來源證明（build provenance attestation）。請在發行工作流程中使用 actions/attest-build-provenance 產生證明。',
                '發行中沒有 exe 或 msi 安裝程式。Windows 版本請以 zip 檔案發布。',
                '發行通過自動檢查。檢查內容請見「安全與免責聲明」頁面。',
              ],
            },
            '是否使用 AI 開發不影響收錄。所有外掛適用相同條件，也不要求申報 AI 的使用。',
            '本平台不會因收錄而認證安全性或品質，請自行確認後再使用。',
          ],
        },
      ],
    },
    submit: {
      title: '提交外掛',
      sections: [
        {
          heading: '使用 Claude Code 製作外掛',
          paragraphs: [
            '如果使用 Claude Code 製作外掛，可以安裝一個技能。它彙整了本平台開發者製作 10 個 OBS Studio 外掛時獲得的經驗，涵蓋規劃、範本準備、OBS API 的常見陷阱、CI 中的無畫面渲染測試、附建置來源證明的發布，以及在本平台上架。',
            '在終端機中執行以下指令進行安裝：',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            '該技能遵循本平台的收錄條件與審查標準：https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: '可以提交的外掛',
          paragraphs: [
            '本平台收錄由 GitHub 儲存庫管理員本人提交的 OBS Studio 外掛。提交前，請確認儲存庫滿足以下全部條件。',
            {
              list: [
                '儲存庫在 GitHub 上公開，且未封存。',
                'GitHub 能偵測到儲存庫的授權。如果 GitHub 未顯示授權，請新增 LICENSE 檔案。',
                '儲存庫根目錄的 CMakeLists.txt 透過 find_package(libobs) 等方式參照 libobs，且儲存庫包含 C 或 C++ 原始碼。',
                'GitHub 上的最新發行附有外掛檔案。GitHub 會為上傳到發行中的檔案記錄 SHA-256，本平台使用該值進行檢查。',
                '最新發行是不可變發行（immutable release）。發布前，請在儲存庫設定中啟用不可變發行。',
                '發行中的每個檔案都有建置來源證明（build provenance attestation）。請在發行工作流程中使用 actions/attest-build-provenance 產生證明。',
                '發行中沒有 exe 或 msi 安裝程式。Windows 版本請以 zip 檔案發布。',
              ],
            },
          ],
        },
        {
          heading: '提交步驟',
          paragraphs: [
            '請將 MCP 用戶端連接到 {{ORIGIN}}/mcp。在 Claude Code 中請執行：',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            '請在 MCP 用戶端中以 GitHub 帳號登入。在 Claude Code 中請執行 /mcp 並選擇 plugin-soko-kun。在 Codex 中請先用 codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp 連接，再用 codex mcp login plugin-soko-kun 登入。本平台本身不會取得 GitHub 儲存庫的寫入權限。',
            '請讓 AI 代理幫您提交，例如：「把 https://github.com/<owner>/<repository> 的 OBS 外掛登記上去」。您也可以告訴代理分類，例如音訊濾鏡或停駐視窗。',
          ],
        },
        {
          heading: '提交之後',
          paragraphs: [
            '本平台將外掛登記為等待檢查。在某個發行通過檢查之前，外掛不會出現在搜尋結果中，也沒有外掛頁面。',
            '檢查每 15 分鐘進行一次，通常在幾小時內完成。',
            '本平台只收錄通過檢查的發行。您在 GitHub 上發布新版本後，本平台會自動取得並檢查它。無需重新提交。',
            '要查看檢查結果，請讓 AI 代理以 list_my_plugins 確認您的外掛，例如：「確認我的外掛的新版本是否已收錄」。代理會顯示每個發行的狀態、未收錄的原因、審查意見以及修改方法。',
            '發布之前，請讓代理以檢查模式執行 submit_plugin。檢查模式會以最新發行判斷收錄條件，並審查預設分支的最新提交。檢查模式不會登記外掛。24 小時內最多可使用 5 次檢查模式。',
            '有些發行需要等待管理員確認。如需說明此類發行中的變更，請在本平台的儲存庫中提出 Issue：https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '提交被拒絕時',
          paragraphs: [
            'AI 代理會顯示原因代碼與修改方法，請修正原因後重新提交。',
            {
              list: [
                'not_admin：您沒有該儲存庫的管理權限。請讓儲存庫管理員提交。',
                'private_repository、archived_repository：請公開儲存庫或解除封存。',
                'no_license：請新增 GitHub 能偵測到的 LICENSE 檔案。',
                'not_obs_plugin：請在根目錄的 CMakeLists.txt 中參照 libobs。',
                'no_release、no_verifiable_asset：請發布附有外掛檔案的版本。',
                'duplicate：該儲存庫已登記。請透過搜尋開啟外掛頁面。',
                'rate_limited：24 小時內最多提交 10 次。請稍後再試。',
                'invalid_url：請以 https://github.com/<owner>/<repository> 的形式指定儲存庫 URL。',
                'not_found：找不到該儲存庫。請確認 URL 以及儲存庫是否公開。',
                'unsupported_tag：發行標籤只能使用字母、數字、「.」、「-」和「_」，且不超過 100 個字元。',
                'github_unavailable：GitHub 未正常回應。請稍後再提交。',
                'not_immutable：請在儲存庫設定中啟用不可變發行，然後發布新版本。',
                'installer_not_allowed：請移除 exe 和 msi 檔案。Windows 版本請以 zip 檔案發布，然後發布新版本。',
                'no_attestation：請在發行工作流程中加入 actions/attest-build-provenance，為每個檔案產生證明，然後發布新版本。',
              ],
            },
          ],
        },
        {
          heading: '標誌與說明圖片',
          paragraphs: [
            '作者可以各展示一張標誌和說明圖片。請將圖片放在儲存庫的 .soko-kun 資料夾中。',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                '標誌：檔案名稱為 logo。請將大小控制在 256 KB 以內，長和寬控制在 1,024 px 以內。',
                '說明圖片：檔案名稱為 image。請將大小控制在 1.5 MB 以內，長和寬控制在 4,096 px 以內。GIF 會以動畫形式播放。',
              ],
            },
            '本平台不接受可包含指令碼的 SVG，因此請使用 png、jpg、jpeg、gif 或 webp 副檔名。',
            '本平台取得最新發行版本標籤時的圖片，因此變更圖片後請發布新的版本。',
            '本平台不顯示不符合條件的圖片，因此若圖片未顯示，請檢查條件。',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            '作者可以在 .soko-kun/config.json 中宣告顯示名稱和支援的作業系統。請將該檔案放在與圖片相同的 .soko-kun 資料夾中。',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name：顯示名稱，1 到 60 個字元。未填寫時，本平台顯示儲存庫名稱。',
                'os：由 windows、macos、linux 組成的陣列。填寫後，本平台只收錄所宣告作業系統的檔案。未填寫時，本平台根據檔案名稱推斷作業系統。',
              ],
            },
            '兩個欄位都是選填的。',
            '本平台讀取每個新發行標籤時的該檔案，因此變更檔案後請發布新的版本。',
            '若檔案內容不符合條件，或沒有所宣告作業系統的檔案，本平台不會收錄該發行。',
          ],
        },
        {
          heading: '更新與撤下',
          paragraphs: [
            '更新收錄內容時，請在 GitHub 上發布新版本。本平台會自動取得新版本，並在通過檢查後收錄。本平台也會根據儲存庫說明更新簡介。',
            '若新版本未被收錄，請讓 AI 代理以 list_my_plugins 確認。代理會顯示原因與修改方法。',
            '撤下收錄時，請將儲存庫設為私人或刪除儲存庫。您也可以依檢舉頁面的方法申請撤下。',
          ],
        },
        {
          id: 'rename',
          heading: '重新命名或轉移儲存庫',
          paragraphs: [
            '本平台透過 GitHub 的儲存庫 ID 追蹤儲存庫，因此重新命名儲存庫時不需要任何操作。收錄會在 15 分鐘內移到新名稱，指向舊名稱的連結會轉址到新名稱。',
            '請不要用舊名稱建立另一個儲存庫。本平台會為已重新命名的外掛保留舊名稱，不會以該名稱收錄其他儲存庫。',
            '如果將儲存庫轉移到其他帳號或組織，已收錄的版本會繼續收錄，下一個版本由管理員確認後再收錄。',
            '要變更顯示名稱，請修改 .soko-kun/config.json 中的 name 並發布新版本。',
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
            '本平台在收錄每個新發行之前都會進行檢查，只收錄通過檢查的發行。',
            {
              list: [
                '來源證明：每個檔案都必須有建置來源證明。GitHub Actions 工作流程會驗證其簽章，並確認證明與儲存庫、發行標籤、標籤的提交以及為該外掛記錄的發行工作流程一致。',
                '不可變發行：發行必須是不可變的。不可變發行中的檔案在發布後無法替換。',
                '惡意軟體查詢：在已知惡意軟體資料庫 MalwareBazaar 中查詢 GitHub 公布的每個檔案的 SHA-256。已收錄的檔案也會定期重新查詢。',
                '與已收錄發行的差異：依規則檢查從已收錄發行到新發行的變更。符合規則的發行將等待管理員確認。',
                '開發實務審查：由儲存庫檔案即可判定的項目（例如 Action 的固定與建置設定）依規則判定。只有需要閱讀文字的項目（例如 README 中的安裝步驟）才由 LLM 搭配本服務計算的事實進行判定。不讀取原始碼。審查標準基於一位 OBS 外掛開發者公開發表的疑慮與建議。有嚴重問題的發行將等待管理員確認。',
              ],
            },
            '審查標準在 GitHub 上公開：https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            '未通過檢查的發行不會顯示。在新發行通過檢查之前，先前收錄的發行將繼續收錄。',
            '如有檔案被判定為惡意軟體，將暫停該外掛的收錄。管理員也可能暫停某個發行。',
            '被暫停的發行會在公告頁面 {{ORIGIN}}/notices 上公布，並附上版本、每個檔案的 SHA-256 以及在本平台收錄的期間。外掛頁面也會顯示警告。',
          ],
        },
        {
          heading: '檢查的限制',
          paragraphs: [
            '惡意軟體查詢只能檢出 MalwareBazaar 中已知的威脅。新型或針對性的惡意軟體可能無法檢出，因此即使未檢出任何問題，也請謹慎使用。',
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
          paragraphs: [
            '錯誤資訊或收錄政策相關問題，請在 GitHub 儲存庫的 Issues 中提交：https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '非公開檢舉',
          paragraphs: [
            '疑似惡意軟體或安全問題，請透過 GitHub 的 Private vulnerability reporting 非公開檢舉：https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            '檢舉由人工確認。僅憑檢舉不會暫停收錄。確認存在明確危險時將暫停收錄，即使儲存庫更新也會繼續暫停。',
          ],
        },
        { heading: '聯絡方式', paragraphs: ['其他詢問請寄至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }] },
      ],
    },
    terms: {
      title: '使用條款',
      sections: [
        {
          heading: '適用範圍',
          paragraphs: [
            '制定日期：2026 年 11 月 9 日',
            '本條款適用於所有使用配信プラグイン倉庫くん（以下稱本平台）網站與 MCP 端點的人，請在同意本條款後使用本平台。',
            '本條款以日文版為準，其他語言版本僅供參考。',
          ],
        },
        {
          heading: '本平台提供的內容',
          paragraphs: [
            '本平台從 GitHub 收集並收錄 OBS Studio 外掛的資訊，並引導使用者前往作者在 GitHub 上發布的檔案。',
            '本平台不保存檔案，也不保證外掛的安全性、品質與運作，請使用者自行確認後再使用。',
          ],
        },
        {
          heading: '提交外掛的作者須遵守的事項',
          paragraphs: [
            '提交外掛的作者請遵守以下事項。',
            {
              list: [
                '只提交自己擁有管理權限的儲存庫。',
                '不刊登不實資訊。',
                '不散布惡意軟體或會傷害使用者的程式。',
                '不侵害第三方的權利。',
              ],
            },
          ],
        },
        {
          heading: '禁止行為',
          paragraphs: [
            '使用者請勿進行以下行為。',
            {
              list: [
                '以大量提交或請求妨礙本平台的營運。',
                '進行未經授權的存取或利用漏洞。',
                '妨礙其他使用者或營運者。',
                '違反法令。',
              ],
            },
          ],
        },
        {
          heading: '收錄的暫停與刪除',
          paragraphs: ['營運者確認違反本條款或對使用者有危險時，可以不經事先通知暫停或刪除收錄。'],
        },
        {
          heading: '免責',
          paragraphs: [
            '對於因使用本平台或安裝外掛而產生的損害，除營運者故意或重大過失的情形外，營運者不負責任。',
            '營運者可能在不預先通知的情況下變更本平台的內容，或中斷、終止提供。',
          ],
        },
        {
          heading: '條款的變更',
          paragraphs: ['營運者會視需要變更本條款，並在本頁面公布變更後的條款及生效日期，請使用者定期查看本頁面。'],
        },
        {
          heading: '準據法與管轄',
          paragraphs: [
            '本條款以日本法律為準據法。',
            '與本條款或本平台有關的爭議，以管轄營運者住所地的地方法院為第一審專屬合意管轄法院。',
          ],
        },
        {
          heading: '聯絡方式',
          paragraphs: ['關於本條款的詢問請寄至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }],
        },
      ],
    },
    privacy: {
      title: '隱私政策',
      sections: [
        { heading: '隱私政策', paragraphs: ['本隱私政策以日文版為準，其他語言版本僅供參考。'] },
        {
          heading: '保存的資訊',
          paragraphs: [
            '為提交外掛而登入時，本服務會保存您的 GitHub 使用者 ID 與登入名稱，以及用於確認儲存庫權限的 GitHub 存取權杖與用於更新該權杖的重新整理權杖。權杖加密保存，僅用於確認您所提交儲存庫的權限。',
            '為防止濫用，本服務會將 IP 位址進行單向雜湊後短期保存。瀏覽目錄時，除記住語言選擇的 cookie 外不使用其他 cookie。',
          ],
        },
        {
          heading: '您可以做的事',
          paragraphs: [
            '您可以隨時在 GitHub 設定的 Applications 中撤銷存取權限。如需刪除資料，請依檢舉頁面的方法提交非公開檢舉。',
          ],
        },
        { heading: '聯絡方式', paragraphs: ['其他詢問請寄至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }] },
      ],
    },
  },
  ko: {
    about: {
      title: '配信プラグイン倉庫くん이란?',
      sections: [
        {
          heading: '이 서비스에 대하여',
          paragraphs: [
            '配信プラグイン倉庫くん(Plugin Soko-kun)은 OBS Studio용 서드파티 플러그인을 위한 독립적이고 개방된 레지스트리입니다. OBS Project 및 OBS Forums와 관계가 없는 비공식 서비스입니다.',
            '이 서비스는 배포 파일을 보관하지 않습니다. 공개된 GitHub 저장소의 정보를 기록하고, 작성자가 GitHub Releases에 공개한 파일로 안내합니다.',
            '이 플랫폼은 배포 파일을 보관하지 않으므로, 배포 파일은 GitHub에서 직접 다운로드해 주세요.',
          ],
        },
        {
          heading: 'AI 에이전트에서 사용하기 (MCP)',
          paragraphs: [
            'MCP 클라이언트를 이 사이트의 /mcp에 연결합니다. Claude Code에서는 다음을 실행합니다:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'Codex에서는 다음을 실행합니다:',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            '검색과 상세 조회는 GitHub 로그인 없이 사용할 수 있습니다. 저장소를 등록할 때는 MCP 클라이언트에서 GitHub로 로그인합니다(Claude Code에서는 /mcp, Codex에서는 codex mcp login plugin-soko-kun 실행). 이 플랫폼 자체가 GitHub 저장소에 대한 쓰기 권한을 얻는 일은 없습니다.',
            '예: "Windows에서 동작하는 피치 시프트 플러그인을 찾아 줘", "이 GitHub 저장소의 OBS 플러그인을 등록해 줘", "내 플러그인의 새 릴리스가 게재되었는지 확인해 줘"',
          ],
        },
        {
          heading: '개발 후원',
          paragraphs: [
            '配信プラグイン倉庫くん은 무료로 사용할 수 있습니다. 운영비와 개발을 후원하고 싶다면 GitHub Sponsors에서 개발자를 후원할 수 있습니다: https://github.com/sponsors/AllegroMoltoV',
            '후원은 선택 사항입니다. 후원 여부는 플러그인의 게재와 검사에 영향을 주지 않습니다.',
          ],
        },
      ],
    },
    policy: {
      title: '게재 정책',
      sections: [
        {
          heading: '게재 정책',
          paragraphs: [
            '이 플랫폼은 GitHub 저장소의 관리자인 작성자가 등록하고 다음 조건을 모두 충족한 플러그인을 게재합니다.',
            {
              list: [
                '저장소가 GitHub에 공개되어 있고, 보관(archive)되어 있지 않을 것.',
                'GitHub가 저장소의 라이선스를 감지할 수 있을 것. GitHub에 라이선스가 표시되지 않으면 LICENSE 파일을 추가해 주세요.',
                '저장소 최상위의 CMakeLists.txt가 find_package(libobs) 등으로 libobs를 참조하고, C 또는 C++ 소스가 있을 것.',
                'GitHub의 최신 릴리스에 플러그인 배포 파일이 첨부되어 있을 것. GitHub는 릴리스에 올린 파일에 SHA-256을 기록하며, 이 플랫폼은 그 값으로 검사합니다.',
                '최신 릴리스가 불변 릴리스(immutable release)일 것. 공개하기 전에 저장소 설정에서 불변 릴리스를 켜 주세요.',
                '릴리스의 모든 배포 파일에 build provenance 증명이 있을 것. 릴리스 워크플로에서 actions/attest-build-provenance로 증명을 만들어 주세요.',
                '배포 파일에 exe나 msi 설치 프로그램이 없을 것. Windows용 배포 파일은 zip으로 배포해 주세요.',
                '릴리스가 자동 검사를 통과할 것. 검사 내용은 보안과 면책 페이지에 적혀 있습니다.',
              ],
            },
            '개발에 AI를 사용했는지 여부는 게재에 영향을 주지 않습니다. 모든 플러그인에 같은 조건을 적용하며, AI 사용의 신고도 요구하지 않습니다.',
            '이 플랫폼은 게재를 통해 안전성이나 품질을 인증하지 않으므로, 직접 확인한 뒤에 이용해 주세요.',
          ],
        },
      ],
    },
    submit: {
      title: '플러그인 등록하기',
      sections: [
        {
          heading: 'Claude Code로 플러그인 만들기',
          paragraphs: [
            'Claude Code로 플러그인을 만든다면, 이 플랫폼의 개발자가 OBS Studio 플러그인 10개를 만들며 얻은 지식을 정리한 스킬을 설치할 수 있습니다. 기획, 템플릿 준비, OBS API의 함정, CI에서의 화면 없는 렌더링 테스트, 빌드 출처 증명이 붙은 릴리스, 이 플랫폼에의 게재를 다룹니다.',
            '터미널에서 다음을 실행해 설치해 주세요:',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            '스킬은 이 플랫폼의 게재 조건과 심사 기준을 따릅니다: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: '등록할 수 있는 플러그인',
          paragraphs: [
            '이 플랫폼은 GitHub 저장소의 관리자인 작성자가 등록한 OBS Studio 플러그인을 게재합니다. 등록하기 전에 저장소가 다음 조건을 모두 충족하는지 확인해 주세요.',
            {
              list: [
                '저장소가 GitHub에 공개되어 있고, 보관(archive)되어 있지 않을 것.',
                'GitHub가 저장소의 라이선스를 감지할 수 있을 것. GitHub에 라이선스가 표시되지 않으면 LICENSE 파일을 추가해 주세요.',
                '저장소 최상위의 CMakeLists.txt가 find_package(libobs) 등으로 libobs를 참조하고, C 또는 C++ 소스가 있을 것.',
                'GitHub의 최신 릴리스에 플러그인 배포 파일이 첨부되어 있을 것. GitHub는 릴리스에 올린 파일에 SHA-256을 기록하며, 이 플랫폼은 그 값으로 검사합니다.',
                '최신 릴리스가 불변 릴리스(immutable release)일 것. 공개하기 전에 저장소 설정에서 불변 릴리스를 켜 주세요.',
                '릴리스의 모든 배포 파일에 build provenance 증명이 있을 것. 릴리스 워크플로에서 actions/attest-build-provenance로 증명을 만들어 주세요.',
                '배포 파일에 exe나 msi 설치 프로그램이 없을 것. Windows용 배포 파일은 zip으로 배포해 주세요.',
              ],
            },
          ],
        },
        {
          heading: '등록 절차',
          paragraphs: [
            'MCP 클라이언트를 엔드포인트({{ORIGIN}}/mcp)에 연결해 주세요. Claude Code에서는 다음을 실행해 주세요:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'MCP 클라이언트에서 GitHub 계정으로 로그인해 주세요. Claude Code에서는 /mcp를 실행하고 plugin-soko-kun을 선택해 주세요. Codex에서는 codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp로 연결한 뒤 codex mcp login plugin-soko-kun로 로그인해 주세요. 이 플랫폼 자체가 GitHub 저장소에 대한 쓰기 권한을 얻는 일은 없습니다.',
            'AI 에이전트에게 등록을 부탁해 주세요. 예: "https://github.com/<owner>/<repository>의 OBS 플러그인을 등록해 줘". 오디오 필터나 도크처럼 카테고리도 전할 수 있습니다.',
          ],
        },
        {
          heading: '등록한 뒤의 흐름',
          paragraphs: [
            '이 플랫폼은 플러그인을 검사 대기로 등록합니다. 릴리스가 검사를 통과하기 전까지 플러그인은 검색과 플러그인 페이지에 나타나지 않습니다.',
            '검사는 15분마다 진행되며, 보통 몇 시간 안에 끝납니다.',
            '이 플랫폼은 검사를 통과한 릴리스만 게재합니다. GitHub에서 새 릴리스를 공개하면 이 플랫폼이 자동으로 가져와 검사합니다. 다시 등록할 필요는 없습니다.',
            '검사 결과는 AI 에이전트에게 list_my_plugins로 확인하게 해 주세요. 예: "내 플러그인의 새 릴리스가 게재되었는지 확인해 줘". 에이전트는 릴리스마다의 상태, 게재되지 않은 이유, 리뷰 지적 사항, 고치는 방법을 보여 줍니다.',
            '릴리스를 공개하기 전에 에이전트에게 submit_plugin의 확인 모드를 실행하게 해 주세요. 확인 모드는 최신 릴리스로 게재 조건을 판정하고, 기본 브랜치의 최신 커밋을 리뷰합니다. 확인 모드에서는 등록하지 않습니다. 확인 모드는 24시간에 5번까지 사용할 수 있습니다.',
            '관리자의 확인을 기다리는 릴리스도 있습니다. 그런 릴리스의 변경 의도를 설명하려면 이 플랫폼 저장소의 Issue에 적어 주세요: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '등록이 거부되었을 때',
          paragraphs: [
            'AI 에이전트가 이유 코드와 고치는 방법을 표시하므로, 원인을 고친 뒤 다시 등록해 주세요.',
            {
              list: [
                'not_admin: 저장소의 관리 권한이 없습니다. 저장소 관리자에게 등록을 부탁해 주세요.',
                'private_repository, archived_repository: 저장소를 공개하거나 보관을 해제해 주세요.',
                'no_license: GitHub가 감지할 수 있는 LICENSE 파일을 추가해 주세요.',
                'not_obs_plugin: 최상위 CMakeLists.txt에서 libobs를 참조해 주세요.',
                'no_release, no_verifiable_asset: 배포 파일을 첨부한 릴리스를 공개해 주세요.',
                'duplicate: 저장소가 이미 등록되어 있습니다. 검색에서 플러그인 페이지를 열어 주세요.',
                'rate_limited: 등록은 24시간에 10번까지입니다. 시간을 두고 다시 등록해 주세요.',
                'invalid_url: 저장소 URL을 https://github.com/<owner>/<repository> 형식으로 지정해 주세요.',
                'not_found: 저장소를 찾을 수 없습니다. URL과 저장소가 공개되어 있는지 확인해 주세요.',
                'unsupported_tag: 릴리스 태그는 영문자, 숫자, ".", "-", "_"만 사용해 100자 이내로 해 주세요.',
                'github_unavailable: GitHub가 정상적으로 응답하지 않았습니다. 시간을 두고 다시 등록해 주세요.',
                'not_immutable: 저장소 설정에서 불변 릴리스를 켠 뒤 새 릴리스를 공개해 주세요.',
                'installer_not_allowed: exe와 msi 파일을 빼 주세요. Windows용은 zip으로 배포하고 새 릴리스를 공개해 주세요.',
                'no_attestation: 릴리스 워크플로에 actions/attest-build-provenance를 추가해 모든 배포 파일에 증명을 붙인 뒤 새 릴리스를 공개해 주세요.',
              ],
            },
          ],
        },
        {
          heading: '로고와 설명 이미지',
          paragraphs: [
            '작성자는 로고와 설명 이미지를 한 장씩 게재할 수 있습니다. 저장소의 .soko-kun 폴더에 이미지를 넣어 주세요.',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                '로고: 파일 이름을 logo로 해 주세요. 크기는 256 KB 이내, 가로와 세로는 1,024 px 이내로 해 주세요.',
                '설명 이미지: 파일 이름을 image로 해 주세요. 크기는 1.5 MB 이내, 가로와 세로는 4,096 px 이내로 해 주세요. GIF는 애니메이션으로 재생됩니다.',
              ],
            },
            '이 플랫폼은 스크립트를 포함할 수 있는 SVG를 받지 않으므로, 확장자는 png, jpg, jpeg, gif, webp 중 하나로 해 주세요.',
            '이 플랫폼은 최신 릴리스 태그 시점의 이미지를 가져오므로, 이미지를 바꾼 뒤에는 새 릴리스를 공개해 주세요.',
            '이 플랫폼은 조건에 맞지 않는 이미지를 게재하지 않으므로, 이미지가 표시되지 않으면 조건을 확인해 주세요.',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            '작성자는 .soko-kun/config.json에서 표시 이름과 지원 OS를 선언할 수 있습니다. 이미지와 같은 .soko-kun 폴더에 파일을 넣어 주세요.',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name: 표시 이름입니다. 1~60자로 적어 주세요. 적지 않으면 저장소 이름을 표시합니다.',
                'os: windows, macos, linux를 배열로 적습니다. 적으면 이 플랫폼은 선언한 OS의 배포 파일만 게재합니다. 적지 않으면 배포 파일 이름에서 OS를 추정합니다.',
              ],
            },
            '두 항목 모두 선택 사항입니다.',
            '이 플랫폼은 새 릴리스 태그 시점의 파일을 읽으므로, 파일을 바꾼 뒤에는 새 릴리스를 공개해 주세요.',
            '파일 내용이 조건에 맞지 않거나 선언한 OS의 배포 파일이 없는 릴리스는 게재하지 않습니다.',
          ],
        },
        {
          heading: '업데이트와 게재 철회',
          paragraphs: [
            '게재 내용을 업데이트하려면 GitHub에서 새 릴리스를 공개해 주세요. 이 플랫폼은 새 릴리스를 자동으로 가져와 검사를 통과하면 게재합니다. 저장소 설명에서 개요도 업데이트합니다.',
            '새 릴리스가 게재되지 않으면 AI 에이전트에게 list_my_plugins로 이유를 확인하게 해 주세요. 에이전트는 이유와 고치는 방법을 보여 줍니다.',
            '게재를 철회하려면 저장소를 비공개로 하거나 삭제해 주세요. 신고 페이지의 방법으로 철회를 요청할 수도 있습니다.',
          ],
        },
        {
          id: 'rename',
          heading: '저장소 이름 변경과 이전',
          paragraphs: [
            '이 플랫폼은 GitHub의 저장소 ID로 저장소를 추적하므로, 저장소 이름을 바꿔도 따로 할 일은 없습니다. 게재는 15분 안에 새 이름으로 옮겨지고, 이전 이름으로 된 링크는 새 이름으로 전송됩니다.',
            '이전 이름으로 다른 저장소를 만들지 마세요. 이전 이름은 이 플랫폼이 이름을 바꾼 플러그인을 위해 남겨 두며, 그 이름으로는 다른 저장소를 등록하지 않습니다.',
            '저장소를 다른 계정이나 조직으로 이전하면, 게재 중인 릴리스는 그대로 게재하고 다음 릴리스는 관리자가 확인한 뒤 게재합니다.',
            '표시 이름을 바꾸려면 .soko-kun/config.json의 name을 바꾸고 새 릴리스를 공개해 주세요.',
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
            '이 플랫폼은 새 릴리스를 게재하기 전에 검사합니다. 검사를 통과한 릴리스만 게재합니다.',
            {
              list: [
                '증명 대조: 모든 배포 파일에 build provenance 증명이 있어야 합니다. GitHub Actions 워크플로가 증명의 서명을 검증합니다. 또한 증명이 저장소, 릴리스 태그, 태그의 커밋, 플러그인에 기록된 릴리스 워크플로와 일치하는지 확인합니다.',
                '불변 릴리스: 릴리스가 불변이어야 합니다. 불변 릴리스의 파일은 공개한 뒤에 바꿀 수 없습니다.',
                '악성 코드 조회: GitHub가 공개하는 각 파일의 SHA-256을 알려진 악성 코드 데이터베이스인 MalwareBazaar에서 조회합니다. 게재 중인 파일도 정기적으로 다시 조회합니다.',
                '게재 중인 릴리스와의 차이: 게재 중인 릴리스에서 새 릴리스까지의 변경을 규칙으로 검사합니다. 규칙에 해당하는 릴리스는 관리자의 확인을 기다립니다.',
                '개발 실천 리뷰: 액션 고정이나 빌드 설정처럼 저장소 파일로 결정되는 항목은 규칙으로 판정합니다. README의 설치 절차처럼 글을 읽어야 하는 항목만 이 서비스가 계산한 사실과 함께 LLM이 판정합니다. 소스 코드는 읽지 않습니다. 기준은 한 OBS 플러그인 개발자가 공개한 우려와 권장 사항을 바탕으로 합니다. 중대한 지적이 있는 릴리스는 관리자의 확인을 기다립니다.',
              ],
            },
            '리뷰 기준은 GitHub에 공개되어 있습니다: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            '검사를 통과하지 않은 릴리스는 표시하지 않습니다. 새 릴리스가 검사를 통과할 때까지는 이전에 게재한 릴리스를 계속 게재합니다.',
            '악성코드로 판정된 파일이 있으면 플러그인의 게재를 중지합니다. 관리자가 릴리스를 중지할 수도 있습니다.',
            '중지한 릴리스는 공지 페이지({{ORIGIN}}/notices)에서 버전, 각 파일의 SHA-256, 이 플랫폼에 게재했던 기간과 함께 알립니다. 플러그인 페이지에도 경고를 표시합니다.',
          ],
        },
        {
          heading: '검사의 한계',
          paragraphs: [
            '악성 코드 조회는 MalwareBazaar에 이미 알려진 위협만 검출할 수 있습니다. 새로운 악성코드나 표적형 악성코드는 검출하지 못할 수 있으므로, 아무것도 검출되지 않아도 주의해서 이용해 주세요.',
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
          paragraphs: [
            '잘못된 정보나 게재 정책에 관한 문제는 GitHub 저장소의 Issues로 접수합니다: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: '비공개 신고',
          paragraphs: [
            '악성코드 의심이나 보안 문제는 GitHub의 Private vulnerability reporting으로 비공개 신고해 주세요: https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            '신고는 사람이 확인합니다. 신고만으로 게재를 중지하지는 않습니다. 명확한 위험이 확인되면 게재를 중지하며, 저장소가 갱신되어도 중지를 유지합니다.',
          ],
        },
        {
          heading: '연락처',
          paragraphs: ['그 밖의 문의는 아래 버튼으로 표시되는 개발자 연락처로 보내 주세요.', { contact: true }],
        },
      ],
    },
    terms: {
      title: '이용약관',
      sections: [
        {
          heading: '적용',
          paragraphs: [
            '제정일: 2026년 11월 9일',
            '이 약관은 配信プラグイン倉庫くん(이하 이 플랫폼)의 웹사이트와 MCP 엔드포인트를 이용하는 모든 사람에게 적용되므로, 이용자는 이 약관에 동의한 뒤 이용해 주세요.',
            '이 약관은 일본어판을 정본으로 하며, 다른 언어판은 참고용 번역입니다.',
          ],
        },
        {
          heading: '이 플랫폼이 제공하는 것',
          paragraphs: [
            '이 플랫폼은 OBS Studio용 플러그인의 정보를 GitHub에서 모아 게재하고, 작성자가 GitHub에 공개한 배포 파일로 안내합니다.',
            '이 플랫폼은 배포 파일을 보관하지 않으며 플러그인의 안전성, 품질, 동작을 보장하지 않으므로, 이용자는 각자의 책임으로 확인한 뒤 이용해 주세요.',
          ],
        },
        {
          heading: '등록하는 작성자가 지켜야 할 것',
          paragraphs: [
            '플러그인을 등록하는 작성자는 다음을 지켜 주세요.',
            {
              list: [
                '자신이 관리 권한을 가진 저장소만 등록할 것.',
                '허위 정보를 게재하지 않을 것.',
                '악성코드나 이용자에게 해를 끼치는 프로그램을 배포하지 않을 것.',
                '제3자의 권리를 침해하지 않을 것.',
              ],
            },
          ],
        },
        {
          heading: '금지 행위',
          paragraphs: [
            '이용자는 다음 행위를 하지 말아 주세요.',
            {
              list: [
                '대량의 등록이나 요청으로 이 플랫폼의 운영을 방해하는 것.',
                '부정 접근이나 취약점을 악용하는 것.',
                '다른 이용자나 운영자를 방해하는 것.',
                '법령을 위반하는 것.',
              ],
            },
          ],
        },
        {
          heading: '게재의 중지와 삭제',
          paragraphs: [
            '운영자는 이 약관의 위반이나 이용자에 대한 위험을 확인한 경우, 사전 통지 없이 게재를 중지하거나 삭제할 수 있습니다.',
          ],
        },
        {
          heading: '면책',
          paragraphs: [
            '운영자는 이 플랫폼의 이용이나 플러그인의 설치로 발생한 손해에 대해, 운영자의 고의 또는 중대한 과실에 의한 경우를 제외하고 책임을 지지 않습니다.',
            '운영자는 예고 없이 이 플랫폼의 내용을 변경하거나 제공을 중단 또는 종료할 수 있습니다.',
          ],
        },
        {
          heading: '약관의 변경',
          paragraphs: [
            '운영자는 필요에 따라 이 약관을 변경하고, 변경 후의 약관과 효력 발생일을 이 페이지에 게재하므로, 이용자는 정기적으로 이 페이지를 확인해 주세요.',
          ],
        },
        {
          heading: '준거법과 관할',
          paragraphs: [
            '이 약관은 일본법에 준거합니다.',
            '이 약관이나 이 플랫폼에 관한 분쟁은 운영자의 주소지를 관할하는 지방법원을 제1심의 전속적 합의 관할 법원으로 합니다.',
          ],
        },
        {
          heading: '연락처',
          paragraphs: ['이 약관에 관한 문의는 아래 버튼으로 표시되는 개발자 연락처로 보내 주세요.', { contact: true }],
        },
      ],
    },
    privacy: {
      title: '개인정보처리방침',
      sections: [
        {
          heading: '개인정보처리방침',
          paragraphs: ['이 개인정보처리방침은 일본어판을 정본으로 하며, 다른 언어판은 참고용 번역입니다.'],
        },
        {
          heading: '저장하는 정보',
          paragraphs: [
            '플러그인 등록을 위해 로그인하면 GitHub 사용자 ID와 로그인 이름, 저장소 권한 확인에 쓰는 GitHub 액세스 토큰과 그 갱신에 쓰는 리프레시 토큰을 저장합니다. 토큰은 암호화하여 저장하며, 등록한 저장소의 권한 확인에만 사용합니다.',
            '남용을 막기 위해 IP 주소를 단방향 해시로 바꾸어 짧은 기간 저장합니다. 카탈로그 열람에서는 선택한 언어를 기억하는 쿠키 외에는 사용하지 않습니다.',
          ],
        },
        {
          heading: '이용자가 할 수 있는 일',
          paragraphs: [
            'GitHub 설정의 Applications에서 언제든지 접근을 취소할 수 있습니다. 데이터 삭제를 원하시면 신고 페이지의 방법으로 비공개 신고를 보내 주세요.',
          ],
        },
        {
          heading: '연락처',
          paragraphs: ['그 밖의 문의는 아래 버튼으로 표시되는 개발자 연락처로 보내 주세요.', { contact: true }],
        },
      ],
    },
  },
  'pt-BR': {
    about: {
      title: 'O que é o Plugin Soko-kun?',
      sections: [
        {
          heading: 'O que é este serviço',
          paragraphs: [
            'Plugin Soko-kun é um registro independente e aberto de plugins de terceiros para o OBS Studio. É um serviço não oficial, sem vínculo com o OBS Project ou o OBS Forums.',
            'O registro não hospeda arquivos. Ele registra informações de repositórios públicos do GitHub e aponta para os arquivos que os autores publicam no GitHub Releases.',
            'Esta plataforma não hospeda arquivos; por isso, baixe os arquivos diretamente do GitHub.',
          ],
        },
        {
          heading: 'Uso com agentes de IA (MCP)',
          paragraphs: [
            'Conecte um cliente MCP ao endereço /mcp deste site. No Claude Code, execute:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'No Codex, execute:',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            'Buscar e ver detalhes funciona sem login no GitHub. Para enviar um repositório, entre com o GitHub pelo cliente MCP (no Claude Code, execute /mcp; no Codex, execute codex mcp login plugin-soko-kun). Esta plataforma em si nunca recebe acesso de escrita aos seus repositórios do GitHub.',
            'Exemplos: "Encontre um plugin de pitch shift que funcione no Windows", "Registre o plugin do OBS deste repositório do GitHub", "Verifique se a nova versão do meu plugin está listada".',
          ],
        },
        {
          heading: 'Apoiar o desenvolvimento',
          paragraphs: [
            'O Plugin Soko-kun é gratuito. Se quiser ajudar com os custos de operação e o desenvolvimento, você pode patrocinar o desenvolvedor no GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
            'O patrocínio é opcional e não afeta a listagem nem a verificação dos plugins.',
          ],
        },
      ],
    },
    policy: {
      title: 'Política de listagem',
      sections: [
        {
          heading: 'Política de listagem',
          paragraphs: [
            'Esta plataforma lista plugins enviados pelo autor que administra o repositório no GitHub e que cumprem todas as condições abaixo.',
            {
              list: [
                'O repositório é público no GitHub e não está arquivado.',
                'O GitHub detecta uma licença no repositório. Se o GitHub não mostrar licença, adicione um arquivo LICENSE.',
                'O CMakeLists.txt da raiz referencia a libobs, por exemplo com find_package(libobs), e o repositório tem código-fonte em C ou C++.',
                'A versão mais recente no GitHub tem os arquivos do plugin anexados. O GitHub registra o SHA-256 dos arquivos enviados a uma versão, e esta plataforma usa esse valor nas verificações.',
                'A versão mais recente é uma versão imutável (immutable release). Ative as versões imutáveis nas configurações do repositório antes de publicá-la.',
                'Todos os arquivos da versão têm um atestado de proveniência de build (build provenance attestation). Gere-o no workflow de release com actions/attest-build-provenance.',
                'A versão não tem instaladores exe ou msi. Distribua as builds para Windows como arquivos zip.',
                'A versão passa nas verificações automáticas. A página Segurança descreve as verificações.',
              ],
            },
            'O uso de IA no desenvolvimento não afeta a listagem. As mesmas condições valem para todos os plugins, e não é preciso declarar o uso de IA.',
            'Esta plataforma não certifica segurança nem qualidade ao listar um plugin; por isso, verifique os plugins antes de usá-los.',
          ],
        },
      ],
    },
    submit: {
      title: 'Enviar um plugin',
      sections: [
        {
          heading: 'Crie seu plugin com o Claude Code',
          paragraphs: [
            'Se você cria o seu plugin com o Claude Code, pode instalar uma skill que reúne o que o desenvolvedor desta plataforma aprendeu ao criar dez plugins para o OBS Studio. Ela cobre o planejamento, a preparação do template, armadilhas comuns da API do OBS, testes de renderização sem tela no CI, releases com atestados de proveniência de build e a listagem nesta plataforma.',
            'Instale-a executando o seguinte em um terminal:',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            'A skill segue as condições de listagem e os critérios de revisão desta plataforma: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: 'Plugins que você pode enviar',
          paragraphs: [
            'Esta plataforma lista plugins do OBS Studio enviados pelo autor que administra o repositório no GitHub. Antes de enviar, confira se o repositório cumpre todas as condições abaixo.',
            {
              list: [
                'O repositório é público no GitHub e não está arquivado.',
                'O GitHub detecta uma licença no repositório. Se o GitHub não mostrar licença, adicione um arquivo LICENSE.',
                'O CMakeLists.txt da raiz referencia a libobs, por exemplo com find_package(libobs), e o repositório tem código-fonte em C ou C++.',
                'A versão mais recente no GitHub tem os arquivos do plugin anexados. O GitHub registra o SHA-256 dos arquivos enviados a uma versão, e esta plataforma usa esse valor nas verificações.',
                'A versão mais recente é uma versão imutável (immutable release). Ative as versões imutáveis nas configurações do repositório antes de publicá-la.',
                'Todos os arquivos da versão têm um atestado de proveniência de build (build provenance attestation). Gere-o no workflow de release com actions/attest-build-provenance.',
                'A versão não tem instaladores exe ou msi. Distribua as builds para Windows como arquivos zip.',
              ],
            },
          ],
        },
        {
          heading: 'Como enviar',
          paragraphs: [
            'Conecte seu cliente MCP a {{ORIGIN}}/mcp. No Claude Code, execute:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'Entre com sua conta do GitHub pelo cliente MCP. No Claude Code, execute /mcp e escolha plugin-soko-kun. No Codex, conecte com codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp e depois entre com codex mcp login plugin-soko-kun. Esta plataforma em si nunca recebe acesso de escrita aos seus repositórios do GitHub.',
            'Peça ao agente de IA para enviar o repositório, por exemplo: "Registre o plugin do OBS em https://github.com/<owner>/<repository>". Você também pode informar a categoria, como filtro de áudio ou dock.',
          ],
        },
        {
          heading: 'Depois do envio',
          paragraphs: [
            'Esta plataforma registra o plugin como aguardando verificação. Até que uma versão passe nas verificações, o plugin não aparece na busca nem tem página própria.',
            'As verificações rodam a cada 15 minutos e costumam terminar em algumas horas.',
            'Esta plataforma lista apenas versões que passam nas verificações. Quando você publica uma nova versão no GitHub, esta plataforma a obtém e a verifica automaticamente. Não é preciso enviá-la de novo.',
            'Para ver os resultados, peça ao agente de IA para verificar seu plugin com list_my_plugins, por exemplo: "Verifique se a nova versão do meu plugin está listada". O agente mostra o estado de cada versão, os motivos de uma versão não estar listada, os apontamentos da revisão e como corrigi-los.',
            'Antes de publicar uma versão, peça ao agente para executar submit_plugin no modo de verificação. Ele avalia as condições de listagem na versão mais recente e revisa o commit mais recente do branch padrão. Ele não registra o plugin. Você pode usar o modo de verificação até 5 vezes em 24 horas.',
            'Algumas versões aguardam a confirmação de um administrador. Para explicar as mudanças de uma versão assim, abra uma issue no repositório desta plataforma: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'Quando o envio é recusado',
          paragraphs: [
            'O agente de IA mostra o código do motivo e como corrigir; por isso, corrija a causa e envie de novo.',
            {
              list: [
                'not_admin: Você não tem permissão de administrador no repositório. Peça a um administrador para enviar.',
                'private_repository, archived_repository: Torne o repositório público ou desarquive-o.',
                'no_license: Adicione um arquivo LICENSE que o GitHub consiga detectar.',
                'not_obs_plugin: Faça o CMakeLists.txt da raiz referenciar a libobs.',
                'no_release, no_verifiable_asset: Publique uma versão com os arquivos do plugin anexados.',
                'duplicate: O repositório já está registrado. Abra a página dele pela busca.',
                'rate_limited: Você pode enviar até 10 vezes em 24 horas. Tente de novo mais tarde.',
                'invalid_url: Informe a URL do repositório no formato https://github.com/<owner>/<repository>.',
                'not_found: O repositório não foi encontrado. Verifique a URL e se o repositório é público.',
                'unsupported_tag: Use uma tag de versão apenas com letras, números, ".", "-" e "_", com até 100 caracteres.',
                'github_unavailable: O GitHub não respondeu normalmente. Tente de novo mais tarde.',
                'not_immutable: Ative as versões imutáveis nas configurações do repositório e publique uma nova versão.',
                'installer_not_allowed: Remova os arquivos exe e msi. Distribua as builds para Windows como arquivos zip e publique uma nova versão.',
                'no_attestation: Adicione actions/attest-build-provenance ao workflow de release para que todos os arquivos tenham atestado e publique uma nova versão.',
              ],
            },
          ],
        },
        {
          heading: 'Logotipo e imagem de descrição',
          paragraphs: [
            'Os autores podem exibir um logotipo e uma imagem de descrição. Coloque as imagens na pasta .soko-kun do repositório.',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                'Logotipo: nomeie o arquivo como logo. Mantenha-o com até 256 KB e até 1.024 px em cada lado.',
                'Imagem de descrição: nomeie o arquivo como image. Mantenha-a com até 1,5 MB e até 4.096 px em cada lado. Imagens GIF são reproduzidas como animações.',
              ],
            },
            'Esta plataforma não aceita SVG, que pode conter scripts; por isso, use a extensão png, jpg, jpeg, gif ou webp.',
            'Esta plataforma obtém as imagens na tag da versão mais recente; por isso, publique uma nova versão depois de alterar uma imagem.',
            'Esta plataforma não exibe imagens que não atendem a essas condições; por isso, verifique as condições se uma imagem não aparecer.',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            'Os autores podem declarar o nome de exibição e os sistemas operacionais suportados em .soko-kun/config.json. Coloque o arquivo na mesma pasta .soko-kun das imagens.',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name: O nome de exibição, de 1 a 60 caracteres. Sem ele, esta plataforma mostra o nome do repositório.',
                'os: Um array com windows, macos e linux. Com ele, esta plataforma lista apenas os arquivos dos sistemas declarados. Sem ele, esta plataforma deduz o sistema pelos nomes dos arquivos.',
              ],
            },
            'Os dois campos são opcionais.',
            'Esta plataforma lê o arquivo na tag de cada nova versão; por isso, publique uma nova versão depois de alterar o arquivo.',
            'Esta plataforma não lista uma versão cujo arquivo seja inválido ou que não tenha arquivos para os sistemas declarados.',
          ],
        },
        {
          heading: 'Atualizar e retirar',
          paragraphs: [
            'Para atualizar a listagem, publique uma nova versão no GitHub. Esta plataforma a obtém automaticamente e a lista depois que ela passa nas verificações. Esta plataforma também atualiza o resumo a partir da descrição do repositório.',
            'Se uma nova versão não for listada, peça ao agente de IA para verificá-la com list_my_plugins. O agente mostra o motivo e como corrigir.',
            'Para retirar a listagem, torne o repositório privado ou exclua-o. Você também pode pedir a retirada como descrito na página Denunciar.',
          ],
        },
        {
          id: 'rename',
          heading: 'Renomear ou transferir o repositório',
          paragraphs: [
            'Esta plataforma acompanha o repositório pelo ID do GitHub, então você não precisa fazer nada ao renomear o repositório. A listagem passa para o novo nome em até 15 minutos, e os links para o nome antigo redirecionam para o novo.',
            'Não crie outro repositório com o nome antigo. Esta plataforma reserva o nome antigo para o plugin renomeado e não registra outro repositório com ele.',
            'Se você transferir o repositório para outra conta ou organização, a versão listada continua listada, e um administrador revisa a próxima versão antes de listá-la.',
            'Para mudar o nome de exibição, altere name em .soko-kun/config.json e publique uma nova versão.',
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
            'Esta plataforma verifica cada nova versão antes de listá-la. Ela lista apenas versões que passam nas verificações.',
            {
              list: [
                'Proveniência: Todos os arquivos precisam ter um atestado de proveniência de build. Um workflow do GitHub Actions verifica a assinatura. O workflow também confirma que o atestado corresponde ao repositório, à tag da versão, ao commit da tag e ao workflow de release registrado para o plugin.',
                'Versão imutável: A versão precisa ser imutável. Os arquivos de uma versão imutável não podem ser substituídos depois da publicação.',
                'Consulta de malware: O SHA-256 de cada arquivo, publicado pelo GitHub, é consultado no MalwareBazaar, um banco de dados de malware conhecido. Os arquivos listados são consultados de novo regularmente.',
                'Mudanças desde a versão listada: As mudanças da versão listada até a nova versão são verificadas com regras. Uma versão que corresponde a uma regra aguarda a confirmação de um administrador.',
                'Revisão das práticas de desenvolvimento: Itens que os arquivos do repositório decidem, como actions fixadas e opções de build, são verificados por regras. Apenas os itens que exigem ler texto, como as instruções de instalação no README, são avaliados por um LLM, com fatos calculados pelo catálogo. A revisão não lê o código-fonte. Os critérios se baseiam em preocupações e recomendações publicadas por um desenvolvedor de plugins do OBS. Uma versão com um apontamento grave aguarda a confirmação de um administrador.',
              ],
            },
            'Os critérios da revisão são públicos no GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            'Versões que não passaram nas verificações não são exibidas. Até que uma nova versão passe, a versão listada anteriormente continua listada.',
            'Um arquivo apontado como malicioso suspende o plugin. Um administrador também pode suspender uma versão.',
            'As versões suspensas são anunciadas na página de avisos {{ORIGIN}}/notices com a versão, o SHA-256 de cada arquivo e o período em que foram listadas aqui. A página do plugin também mostra um aviso.',
          ],
        },
        {
          heading: 'Limites das verificações',
          paragraphs: [
            'A consulta de malware detecta apenas ameaças já conhecidas pelo MalwareBazaar. Malwares novos ou direcionados podem não ser detectados; por isso, use os plugins com cuidado mesmo quando nada for detectado.',
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
            'Informe dados incorretos ou problemas de política como issue no repositório do GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'Denúncias privadas',
          paragraphs: [
            'Informe suspeitas de malware ou problemas de segurança de forma privada pelo private vulnerability reporting do GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            'As denúncias são analisadas por uma pessoa. Uma denúncia, por si só, não suspende uma listagem. Quando um perigo claro é confirmado, a listagem é suspensa e continua suspensa mesmo que o repositório mude.',
          ],
        },
        {
          heading: 'Contato',
          paragraphs: [
            'Envie outras dúvidas ao contato do desenvolvedor exibido pelo botão abaixo.',
            { contact: true },
          ],
        },
      ],
    },
    terms: {
      title: 'Termos de uso',
      sections: [
        {
          heading: 'Aplicação',
          paragraphs: [
            'Data de criação: 9 de novembro de 2026',
            'Estes termos se aplicam a todos que usam o site e o endpoint MCP do Plugin Soko-kun (esta plataforma); por isso, use esta plataforma somente após concordar com estes termos.',
            'A versão em japonês destes termos prevalece, e as outras versões são traduções de referência.',
          ],
        },
        {
          heading: 'O que esta plataforma oferece',
          paragraphs: [
            'Esta plataforma coleta no GitHub informações sobre plugins do OBS Studio, as lista e orienta os usuários aos arquivos que os autores publicaram no GitHub.',
            'Esta plataforma não hospeda arquivos e não garante a segurança, a qualidade ou o funcionamento dos plugins; por isso, verifique os plugins antes de usá-los.',
          ],
        },
        {
          heading: 'Obrigações dos autores que enviam plugins',
          paragraphs: [
            'Os autores que enviam plugins devem seguir estas regras.',
            {
              list: [
                'Envie apenas repositórios que você administra.',
                'Não publique informações falsas.',
                'Não distribua malware nem programas que prejudiquem usuários.',
                'Não viole direitos de terceiros.',
              ],
            },
          ],
        },
        {
          heading: 'Atos proibidos',
          paragraphs: [
            'Não faça nenhuma das ações abaixo.',
            {
              list: [
                'Prejudicar a operação desta plataforma com envios ou solicitações em massa.',
                'Acessar sem autorização ou explorar vulnerabilidades.',
                'Interferir com outros usuários ou com o operador.',
                'Violar leis ou regulamentos.',
              ],
            },
          ],
        },
        {
          heading: 'Suspensão e remoção de listagens',
          paragraphs: [
            'O operador pode suspender ou remover uma listagem sem aviso prévio quando confirmar uma violação destes termos ou um perigo aos usuários.',
          ],
        },
        {
          heading: 'Isenção de responsabilidade',
          paragraphs: [
            'O operador não se responsabiliza por danos decorrentes do uso desta plataforma ou da instalação de plugins, exceto em casos de dolo ou culpa grave do operador.',
            'O operador pode alterar o conteúdo desta plataforma, ou suspendê-la ou encerrá-la, sem aviso.',
          ],
        },
        {
          heading: 'Alterações destes termos',
          paragraphs: [
            'O operador altera estes termos quando necessário e publica nesta página os termos alterados e a data de vigência; por isso, confira esta página regularmente.',
          ],
        },
        {
          heading: 'Lei aplicável e foro',
          paragraphs: [
            'Estes termos são regidos pelas leis do Japão.',
            'O tribunal distrital com jurisdição sobre o endereço do operador é o foro exclusivo de primeira instância para disputas sobre estes termos ou esta plataforma.',
          ],
        },
        {
          heading: 'Contato',
          paragraphs: [
            'Envie dúvidas sobre estes termos ao contato do desenvolvedor exibido pelo botão abaixo.',
            { contact: true },
          ],
        },
      ],
    },
    privacy: {
      title: 'Política de privacidade',
      sections: [
        {
          heading: 'Política de privacidade',
          paragraphs: [
            'A versão em japonês desta política de privacidade prevalece, e as outras versões são traduções de referência.',
          ],
        },
        {
          heading: 'O que é armazenado',
          paragraphs: [
            'Ao entrar para enviar um plugin, o serviço armazena seu ID de usuário e nome de login do GitHub, além do token de acesso do GitHub necessário para verificar as permissões do repositório e do token de atualização usado para renová-lo. Os tokens são armazenados criptografados e usados apenas para verificar permissões nos repositórios que você envia.',
            'Para limitar abusos, o serviço armazena por pouco tempo um hash irreversível do seu endereço IP. Navegar pelo catálogo não usa cookies, exceto um que lembra o idioma escolhido.',
          ],
        },
        {
          heading: 'Suas opções',
          paragraphs: [
            'Você pode revogar o acesso a qualquer momento nas configurações do GitHub, em Applications. Para pedir a exclusão dos seus dados, envie uma denúncia privada como descrito na página Denunciar.',
          ],
        },
        {
          heading: 'Contato',
          paragraphs: [
            'Envie outras dúvidas ao contato do desenvolvedor exibido pelo botão abaixo.',
            { contact: true },
          ],
        },
      ],
    },
  },
  'es-419': {
    about: {
      title: '¿Qué es Plugin Soko-kun?',
      sections: [
        {
          heading: 'Qué es este servicio',
          paragraphs: [
            'Plugin Soko-kun es un registro independiente y abierto de plugins de terceros para OBS Studio. Es un servicio no oficial que no tiene relación con OBS Project ni con OBS Forums.',
            'El registro no aloja archivos. Registra información de repositorios públicos de GitHub y enlaza a los archivos que los autores publican en GitHub Releases.',
            'Esta plataforma no aloja archivos; por eso, descarga los archivos directamente de GitHub.',
          ],
        },
        {
          heading: 'Uso con agentes de IA (MCP)',
          paragraphs: [
            'Conecta un cliente MCP a la dirección /mcp de este sitio. En Claude Code, ejecuta:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'En Codex, ejecuta:',
            { code: 'codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp' },
            'Buscar y ver detalles funciona sin iniciar sesión en GitHub. Para enviar un repositorio, inicia sesión con GitHub desde el cliente MCP (en Claude Code, ejecuta /mcp; en Codex, ejecuta codex mcp login plugin-soko-kun). Esta plataforma en sí nunca obtiene acceso de escritura a tus repositorios de GitHub.',
            'Ejemplos: "Busca un plugin de pitch shift que funcione en Windows", "Registra el plugin de OBS de este repositorio de GitHub", "Revisa si la nueva versión de mi plugin está en la lista".',
          ],
        },
        {
          heading: 'Apoyar el desarrollo',
          paragraphs: [
            'Plugin Soko-kun es gratuito. Si quieres ayudar con los costos de operación y el desarrollo, puedes patrocinar al desarrollador en GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
            'El patrocinio es opcional y no afecta la publicación ni la verificación de los plugins.',
          ],
        },
      ],
    },
    policy: {
      title: 'Política de la lista',
      sections: [
        {
          heading: 'Política de la lista',
          paragraphs: [
            'Esta plataforma incluye plugins enviados por el autor que administra el repositorio de GitHub y que cumplen todas estas condiciones.',
            {
              list: [
                'El repositorio es público en GitHub y no está archivado.',
                'GitHub detecta una licencia en el repositorio. Si GitHub no muestra una licencia, agrega un archivo LICENSE.',
                'El CMakeLists.txt de la raíz hace referencia a libobs, por ejemplo con find_package(libobs), y el repositorio tiene código fuente en C o C++.',
                'La versión más reciente en GitHub tiene los archivos del plugin adjuntos. GitHub registra el SHA-256 de los archivos que subes a una versión, y esta plataforma usa ese valor en las revisiones.',
                'La versión más reciente es una versión inmutable (immutable release). Activa las versiones inmutables en la configuración del repositorio antes de publicarla.',
                'Todos los archivos de la versión tienen una atestación de procedencia de compilación (build provenance attestation). Créala en el workflow de publicación con actions/attest-build-provenance.',
                'La versión no incluye instaladores exe ni msi. Distribuye las compilaciones para Windows como archivos zip.',
                'La versión pasa las revisiones automáticas. La página Seguridad describe las revisiones.',
              ],
            },
            'Haber usado IA en el desarrollo no afecta la lista. Las mismas condiciones aplican a todos los plugins y no es necesario declarar el uso de IA.',
            'Esta plataforma no certifica la seguridad ni la calidad al incluir un plugin; por eso, revisa los plugins antes de usarlos.',
          ],
        },
      ],
    },
    submit: {
      title: 'Enviar un plugin',
      sections: [
        {
          heading: 'Crea tu plugin con Claude Code',
          paragraphs: [
            'Si creas tu plugin con Claude Code, puedes instalar una skill que reúne lo que el desarrollador de esta plataforma aprendió al crear diez plugins para OBS Studio. Cubre la planificación, la preparación de la plantilla, errores comunes de la API de OBS, pruebas de renderizado sin pantalla en CI, releases con atestaciones de procedencia de compilación y la publicación en esta plataforma.',
            'Instálala ejecutando lo siguiente en una terminal:',
            {
              code: 'claude plugin marketplace add AllegroMoltoV/plugin-soko-kun\nclaude plugin install soko-kun-plugin-dev@plugin-soko-kun',
            },
            'La skill sigue las condiciones de publicación y los criterios de revisión de esta plataforma: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          ],
        },
        {
          heading: 'Plugins que puedes enviar',
          paragraphs: [
            'Esta plataforma incluye plugins de OBS Studio enviados por el autor que administra el repositorio de GitHub. Antes de enviar, revisa que el repositorio cumpla todas estas condiciones.',
            {
              list: [
                'El repositorio es público en GitHub y no está archivado.',
                'GitHub detecta una licencia en el repositorio. Si GitHub no muestra una licencia, agrega un archivo LICENSE.',
                'El CMakeLists.txt de la raíz hace referencia a libobs, por ejemplo con find_package(libobs), y el repositorio tiene código fuente en C o C++.',
                'La versión más reciente en GitHub tiene los archivos del plugin adjuntos. GitHub registra el SHA-256 de los archivos que subes a una versión, y esta plataforma usa ese valor en las revisiones.',
                'La versión más reciente es una versión inmutable (immutable release). Activa las versiones inmutables en la configuración del repositorio antes de publicarla.',
                'Todos los archivos de la versión tienen una atestación de procedencia de compilación (build provenance attestation). Créala en el workflow de publicación con actions/attest-build-provenance.',
                'La versión no incluye instaladores exe ni msi. Distribuye las compilaciones para Windows como archivos zip.',
              ],
            },
          ],
        },
        {
          heading: 'Cómo enviar',
          paragraphs: [
            'Conecta tu cliente MCP a {{ORIGIN}}/mcp. En Claude Code, ejecuta:',
            { code: 'claude mcp add --transport http plugin-soko-kun {{ORIGIN}}/mcp' },
            'Inicia sesión con tu cuenta de GitHub desde el cliente MCP. En Claude Code, ejecuta /mcp y elige plugin-soko-kun. En Codex, conéctate con codex mcp add plugin-soko-kun --url {{ORIGIN}}/mcp y luego inicia sesión con codex mcp login plugin-soko-kun. Esta plataforma en sí nunca obtiene acceso de escritura a tus repositorios de GitHub.',
            'Pide al agente de IA que envíe el repositorio, por ejemplo: "Registra el plugin de OBS de https://github.com/<owner>/<repository>". También puedes indicar la categoría, como filtro de audio o panel.',
          ],
        },
        {
          heading: 'Después de enviar',
          paragraphs: [
            'Esta plataforma registra el plugin en espera de revisión. Hasta que una versión pasa las revisiones, el plugin no aparece en la búsqueda ni tiene página propia.',
            'Las revisiones se ejecutan cada 15 minutos y suelen terminar en unas horas.',
            'Esta plataforma incluye solo versiones que pasan las revisiones. Cuando publicas una nueva versión en GitHub, esta plataforma la obtiene y la revisa automáticamente. No necesitas enviarla de nuevo.',
            'Para ver los resultados, pide al agente de IA que revise tu plugin con list_my_plugins, por ejemplo: "Revisa si la nueva versión de mi plugin está en la lista". El agente muestra el estado de cada versión, los motivos por los que una versión no está en la lista, las observaciones de la revisión y cómo corregirlas.',
            'Antes de publicar una versión, pide al agente que ejecute submit_plugin en modo de comprobación. Este modo evalúa las condiciones de la lista en la versión más reciente y revisa el commit más reciente de la rama predeterminada. No registra el plugin. Puedes usar el modo de comprobación hasta 5 veces en 24 horas.',
            'Algunas versiones esperan la confirmación de un administrador. Para explicar los cambios de una versión así, abre un issue en el repositorio de esta plataforma: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'Cuando se rechaza un envío',
          paragraphs: [
            'El agente de IA muestra el código del motivo y cómo corregirlo; por eso, corrige la causa y vuelve a enviar.',
            {
              list: [
                'not_admin: No tienes permiso de administrador en el repositorio. Pide a un administrador que lo envíe.',
                'private_repository, archived_repository: Haz público el repositorio o desarchívalo.',
                'no_license: Agrega un archivo LICENSE que GitHub pueda detectar.',
                'not_obs_plugin: Haz que el CMakeLists.txt de la raíz haga referencia a libobs.',
                'no_release, no_verifiable_asset: Publica una versión con los archivos del plugin adjuntos.',
                'duplicate: El repositorio ya está registrado. Abre su página desde la búsqueda.',
                'rate_limited: Puedes enviar hasta 10 veces en 24 horas. Vuelve a intentarlo más tarde.',
                'invalid_url: Indica la URL del repositorio con el formato https://github.com/<owner>/<repository>.',
                'not_found: No se encontró el repositorio. Revisa la URL y que el repositorio sea público.',
                'unsupported_tag: Usa una etiqueta de versión solo con letras, números, ".", "-" y "_", de hasta 100 caracteres.',
                'github_unavailable: GitHub no respondió con normalidad. Vuelve a intentarlo más tarde.',
                'not_immutable: Activa las versiones inmutables en la configuración del repositorio y publica una nueva versión.',
                'installer_not_allowed: Quita los archivos exe y msi. Distribuye las compilaciones para Windows como archivos zip y publica una nueva versión.',
                'no_attestation: Agrega actions/attest-build-provenance al workflow de publicación para que todos los archivos tengan atestación, y publica una nueva versión.',
              ],
            },
          ],
        },
        {
          heading: 'Logotipo e imagen descriptiva',
          paragraphs: [
            'Los autores pueden mostrar un logotipo y una imagen descriptiva. Coloca las imágenes en la carpeta .soko-kun del repositorio.',
            { code: '.soko-kun/logo.png\n.soko-kun/image.gif' },
            {
              list: [
                'Logotipo: nombra el archivo logo. Mantenlo en 256 KB como máximo y en 1,024 px por lado como máximo.',
                'Imagen descriptiva: nombra el archivo image. Mantenla en 1.5 MB como máximo y en 4,096 px por lado como máximo. Las imágenes GIF se reproducen como animaciones.',
              ],
            },
            'Esta plataforma no acepta SVG, que puede contener scripts; por eso, usa la extensión png, jpg, jpeg, gif o webp.',
            'Esta plataforma obtiene las imágenes en la etiqueta de la versión más reciente; por eso, publica una nueva versión después de cambiar una imagen.',
            'Esta plataforma no muestra imágenes que no cumplen estas condiciones; por eso, revisa las condiciones si una imagen no aparece.',
          ],
        },
        {
          heading: '.soko-kun/config.json',
          paragraphs: [
            'Los autores pueden declarar el nombre visible y los sistemas operativos compatibles en .soko-kun/config.json. Coloca el archivo en la misma carpeta .soko-kun que las imágenes.',
            { code: '{\n  "name": "Simple Mosaic",\n  "os": ["windows", "macos"]\n}' },
            {
              list: [
                'name: El nombre visible, de 1 a 60 caracteres. Si no lo indicas, esta plataforma muestra el nombre del repositorio.',
                'os: Un arreglo con windows, macos y linux. Si lo indicas, esta plataforma incluye solo los archivos de los sistemas declarados. Si no lo indicas, esta plataforma deduce el sistema a partir de los nombres de los archivos.',
              ],
            },
            'Ambos campos son opcionales.',
            'Esta plataforma lee el archivo en la etiqueta de cada nueva versión; por eso, publica una nueva versión después de cambiar el archivo.',
            'Esta plataforma no incluye una versión cuyo archivo no es válido o que no tiene archivos para los sistemas declarados.',
          ],
        },
        {
          heading: 'Actualizar y retirar',
          paragraphs: [
            'Para actualizar la publicación, publica una nueva versión en GitHub. Esta plataforma la obtiene automáticamente y la incluye después de que pasa las revisiones. Esta plataforma también actualiza el resumen a partir de la descripción del repositorio.',
            'Si una nueva versión no aparece en la lista, pide al agente de IA que la revise con list_my_plugins. El agente muestra el motivo y cómo corregirlo.',
            'Para retirar la publicación, haz privado el repositorio o elimínalo. También puedes pedir el retiro como se describe en la página Reportar.',
          ],
        },
        {
          id: 'rename',
          heading: 'Cambiar el nombre o transferir el repositorio',
          paragraphs: [
            'Esta plataforma sigue el repositorio por su ID de GitHub, así que no necesitas hacer nada al cambiar el nombre del repositorio. La publicación pasa al nuevo nombre en un máximo de 15 minutos, y los enlaces al nombre anterior redirigen al nuevo.',
            'No crees otro repositorio con el nombre anterior. Esta plataforma reserva el nombre anterior para el plugin renombrado y no registra otro repositorio con ese nombre.',
            'Si transfieres el repositorio a otra cuenta u organización, la versión publicada sigue publicada, y un administrador revisa la siguiente versión antes de publicarla.',
            'Para cambiar el nombre visible, cambia name en .soko-kun/config.json y publica una nueva versión.',
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
            'Esta plataforma revisa cada nueva versión antes de incluirla. Solo incluye versiones que pasan las revisiones.',
            {
              list: [
                'Procedencia: Todos los archivos deben tener una atestación de procedencia de compilación. Un workflow de GitHub Actions verifica su firma. El workflow también confirma que la atestación coincide con el repositorio, la etiqueta de la versión, el commit de la etiqueta y el workflow de publicación registrado para el plugin.',
                'Versión inmutable: La versión debe ser inmutable. Los archivos de una versión inmutable no se pueden reemplazar después de publicarla.',
                'Consulta de malware: El SHA-256 de cada archivo, publicado por GitHub, se consulta en MalwareBazaar, una base de datos de malware conocido. Los archivos incluidos se vuelven a consultar con regularidad.',
                'Cambios desde la versión incluida: Los cambios desde la versión incluida hasta la nueva versión se revisan con reglas. Una versión que coincide con una regla espera la confirmación de un administrador.',
                'Revisión de prácticas de desarrollo: Los elementos que deciden los archivos del repositorio, como las actions fijadas y las opciones de compilación, se comprueban con reglas. Solo los elementos que requieren leer texto, como las instrucciones de instalación del README, los evalúa un LLM, con hechos calculados por el catálogo. La revisión no lee el código fuente. Los criterios se basan en preocupaciones y recomendaciones que publicó un desarrollador de plugins de OBS. Una versión con una observación grave espera la confirmación de un administrador.',
              ],
            },
            'Los criterios de la revisión son públicos en GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md',
            'Las versiones que no pasaron las revisiones no se muestran. Hasta que una nueva versión pasa, la versión incluida anteriormente sigue en la lista.',
            'Un archivo marcado como malicioso suspende el plugin. Un administrador también puede suspender una versión.',
            'Las versiones suspendidas se anuncian en la página de avisos {{ORIGIN}}/notices con la versión, el SHA-256 de cada archivo y el periodo en que estuvieron en la lista aquí. La página del plugin también muestra una advertencia.',
          ],
        },
        {
          heading: 'Límites de las revisiones',
          paragraphs: [
            'La consulta de malware solo detecta amenazas ya conocidas por MalwareBazaar. El malware nuevo o dirigido podría no detectarse; por eso, usa los plugins con cuidado aunque no haya detecciones.',
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
            'Reporta información incorrecta o problemas de política como issue en el repositorio de GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/issues',
          ],
        },
        {
          heading: 'Reportes privados',
          paragraphs: [
            'Reporta sospechas de malware o problemas de seguridad en privado mediante el private vulnerability reporting de GitHub: https://github.com/AllegroMoltoV/plugin-soko-kun/security/advisories/new',
            'Una persona revisa los reportes. Un reporte por sí solo no suspende una publicación. Cuando se confirma un peligro claro, la publicación se suspende y sigue suspendida aunque el repositorio cambie.',
          ],
        },
        {
          heading: 'Contacto',
          paragraphs: [
            'Envía otras consultas al contacto del desarrollador que muestra el botón de abajo.',
            { contact: true },
          ],
        },
      ],
    },
    terms: {
      title: 'Términos de uso',
      sections: [
        {
          heading: 'Aplicación',
          paragraphs: [
            'Fecha de establecimiento: 9 de noviembre de 2026',
            'Estos términos se aplican a todas las personas que usan el sitio web y el endpoint MCP de Plugin Soko-kun (esta plataforma); por eso, usa esta plataforma solo después de aceptar estos términos.',
            'La versión en japonés de estos términos prevalece, y las demás versiones son traducciones de referencia.',
          ],
        },
        {
          heading: 'Lo que ofrece esta plataforma',
          paragraphs: [
            'Esta plataforma recopila de GitHub información sobre plugins de OBS Studio, la publica y guía a los usuarios a los archivos que los autores publicaron en GitHub.',
            'Esta plataforma no aloja archivos ni garantiza la seguridad, la calidad o el funcionamiento de los plugins; por eso, revisa los plugins antes de usarlos.',
          ],
        },
        {
          heading: 'Obligaciones de los autores que envían plugins',
          paragraphs: [
            'Los autores que envían plugins deben seguir estas reglas.',
            {
              list: [
                'Envía solo repositorios que administras.',
                'No publiques información falsa.',
                'No distribuyas malware ni programas que dañen a los usuarios.',
                'No infrinjas los derechos de terceros.',
              ],
            },
          ],
        },
        {
          heading: 'Actos prohibidos',
          paragraphs: [
            'No hagas ninguna de estas acciones.',
            {
              list: [
                'Perjudicar la operación de esta plataforma con envíos o solicitudes masivos.',
                'Acceder sin autorización o aprovechar vulnerabilidades.',
                'Interferir con otros usuarios o con el operador.',
                'Infringir leyes o reglamentos.',
              ],
            },
          ],
        },
        {
          heading: 'Suspensión y retiro de publicaciones',
          paragraphs: [
            'El operador puede suspender o retirar una publicación sin aviso previo cuando confirme una infracción de estos términos o un peligro para los usuarios.',
          ],
        },
        {
          heading: 'Descargo de responsabilidad',
          paragraphs: [
            'El operador no es responsable de los daños derivados del uso de esta plataforma o de la instalación de plugins, salvo en casos de dolo o culpa grave del operador.',
            'El operador puede cambiar el contenido de esta plataforma, o suspenderla o terminarla, sin aviso.',
          ],
        },
        {
          heading: 'Cambios en estos términos',
          paragraphs: [
            'El operador cambia estos términos cuando es necesario y publica en esta página los términos modificados y su fecha de vigencia; por eso, revisa esta página con regularidad.',
          ],
        },
        {
          heading: 'Ley aplicable y jurisdicción',
          paragraphs: [
            'Estos términos se rigen por las leyes de Japón.',
            'El tribunal de distrito con jurisdicción sobre el domicilio del operador es el tribunal exclusivo de primera instancia para las disputas sobre estos términos o esta plataforma.',
          ],
        },
        {
          heading: 'Contacto',
          paragraphs: [
            'Envía tus preguntas sobre estos términos al contacto del desarrollador que muestra el botón de abajo.',
            { contact: true },
          ],
        },
      ],
    },
    privacy: {
      title: 'Política de privacidad',
      sections: [
        {
          heading: 'Política de privacidad',
          paragraphs: [
            'La versión en japonés de esta política de privacidad prevalece, y las demás versiones son traducciones de referencia.',
          ],
        },
        {
          heading: 'Qué se guarda',
          paragraphs: [
            'Al iniciar sesión para enviar un plugin, el servicio guarda tu ID de usuario y nombre de inicio de sesión de GitHub, y el token de acceso de GitHub necesario para revisar los permisos del repositorio, junto con el token de actualización usado para renovarlo. Los tokens se guardan cifrados y solo se usan para revisar permisos en los repositorios que envías.',
            'Para limitar abusos, el servicio guarda por poco tiempo un hash irreversible de tu dirección IP. Navegar por el catálogo no usa cookies, salvo una que recuerda el idioma elegido.',
          ],
        },
        {
          heading: 'Tus opciones',
          paragraphs: [
            'Puedes revocar el acceso en cualquier momento en la configuración de GitHub, en Applications. Para pedir que se borren tus datos, envía un reporte privado como se describe en la página Reportar.',
          ],
        },
        {
          heading: 'Contacto',
          paragraphs: [
            'Envía otras consultas al contacto del desarrollador que muestra el botón de abajo.',
            { contact: true },
          ],
        },
      ],
    },
  },
};
