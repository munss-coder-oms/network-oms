# 옵시디언 설치와 동기화 (PC 편집 + 폰 열람)

목표 구성입니다.

| 어디서 | 무엇을 | 어떻게 |
| --- | --- | --- |
| PC | 편집, 마인드맵 보기, 깊게 파기 | Obsidian 데스크톱 + Obsidian Git 플러그인 |
| 폰 | 열람만 | 노션 앱 (설정 0) + 필요하면 Obsidian 모바일 |
| Claude | 노트 생성, 커밋, 푸시 | 원격 세션에서 자동 |

---

## 1. PC 설치

### 1-1. 옵시디언 설치

[obsidian.md](https://obsidian.md) 에서 내려받습니다. Windows·macOS·Linux 모두 있고 개인 용도는 무료입니다.

### 1-2. 저장소 클론

```bash
git clone https://github.com/munss-coder-oms/network-oms.git ~/network-oms
```

### 1-3. 볼트로 열기 — ⚠️ 저장소 루트를 엽니다

Obsidian → **폴더를 볼트로 열기(Open folder as vault)** → **`~/network-oms`** 선택.

`~/network-oms/vault` 가 아니라 **`~/network-oms`** 입니다. 헷갈리기 쉬운데 이유가 있습니다.

> Obsidian Git 플러그인은 **git 저장소가 볼트 안에 있어야** 동작합니다. 플러그인의 "custom base path" 설정도 *볼트 안의 하위 폴더*를 저장소로 지정하는 용도라서, 저장소가 볼트보다 **위에** 있는 경우는 지원하지 않습니다. `vault/` 를 볼트로 열면 git 저장소가 한 단계 위에 있게 되어 플러그인이 저장소를 못 찾습니다.

저장소 루트를 열어도 파일 탐색기는 지저분해지지 않습니다. Obsidian은 자기가 못 여는 확장자(`.js` `.json` `.ipynb` `.html`)와 점으로 시작하는 폴더(`.claude/` `.git/`)를 기본으로 숨깁니다. 실제로 보이는 건 `vault/` 전체와 `README.md`, `docs/` 정도입니다.

`README.md` 와 `docs/` 까지 그래프에서 빼고 싶으면 **설정 → 파일 및 링크 → 제외할 파일**에 `docs` 를 추가하세요.

### 1-4. Obsidian Git 플러그인 설치

1. 설정 → **커뮤니티 플러그인** → 제한 모드(Restricted mode) **끄기**
2. **찾아보기** → `Git` 검색 → 제작자 `Vinzent03` 것 설치 → 활성화

데스크톱 플러그인은 시스템에 깔린 git을 그대로 씁니다. 그래서 터미널에서 `git` 이 되면 플러그인도 됩니다. (git이 없다면 [git-scm.com](https://git-scm.com) 에서 먼저 설치)

### 1-5. 인증

GitHub는 비밀번호 대신 **Personal Access Token(PAT)** 을 씁니다. 터미널에서 한 번만 설정해두면 플러그인이 이어서 씁니다.

```bash
# 자격증명 저장소 켜기 (macOS)
git config --global credential.helper osxkeychain
# Windows 는 보통 manager 가 기본, Linux 는:
git config --global credential.helper store

cd ~/network-oms
git pull    # 처음 한 번 아이디 + PAT 입력
```

PAT는 GitHub → Settings → Developer settings → Personal access tokens에서 만들고, 이 저장소에 대한 **Contents: Read and write** 권한을 줍니다.

### 1-6. 플러그인 설정 권장값

설정 → Git 에서:

| 항목 | 값 | 이유 |
| --- | --- | --- |
| Auto pull on startup | 켜기 | 옵시디언 열 때 Claude가 만든 노트를 받아옴 |
| Pull on startup / Auto pull interval | 10분 | 세션 중에도 반영됨 |
| Auto commit-and-sync interval | 10분 (또는 끄기) | 내가 PC에서 고친 내용을 올림 |
| Commit message | `vault: {{date}}` | 이력 읽기 편하게 |

> 저장소 루트를 볼트로 열었으니 **자동 커밋은 저장소 전체를 커밋합니다.** 노트만 다루실 거면 상관없지만, 코드도 만질 예정이면 자동 커밋을 끄고 필요할 때 수동으로 `Commit-and-sync` 명령을 쓰세요.

### 1-7. 확인

`vault/90-Maps/_전체지도.canvas` 를 열어보세요. 주제 노드가 보이고 클릭하면 노트로 들어가면 성공입니다.

---

## 2. 폰 — 열람 전용

### 2-1. 노션 앱 (설정 필요 없음, 이미 됨)

세션 상세 기록은 [생각 로그 DB](https://app.notion.com/p/b35f031bdba74f6990c1d941b7714521) 에 그대로 쌓입니다. 폰에서 노션 앱만 깔면 원문·질문·답변·마무리 3줄까지 다 읽힙니다. **마인드맵 그림만 안 보입니다.**

이동 중 "내가 저번에 뭐라고 했더라" 를 확인하는 용도라면 이걸로 충분합니다.

### 2-2. 폰에서도 마인드맵을 봐야 한다면

솔직하게 말씀드리면, **Obsidian Git 플러그인은 모바일에서 권장되지 않습니다.** 제작자가 README에 직접 이렇게 써놨습니다.

> "The Git implementation on mobile is very unstable! I would not recommend using this plugin on mobile."

모바일에서는 네이티브 git을 쓸 수 없어 JavaScript 구현(isomorphic-git)으로 돌아가는데, 기기 메모리에 따라 clone/pull 중에 앱이 죽거나 무한정 도는 일이 있습니다. iOS·안드로이드 둘 다 해당됩니다. SSH 인증도 안 되고 저장소 크기 제한도 있습니다.

그래서 두 가지 대안이 있습니다.

| 방법 | 비용 | 특징 |
| --- | --- | --- |
| **GitSync** | 무료 | Obsidian Git 제작자가 README에서 직접 권하는 대안. iOS·안드로이드 둘 다 지원 |
| **Obsidian Sync** | 유료 (공식) | 폰에서 git을 아예 안 씀. PC가 git을 담당하고 Sync가 폰으로 미러링. 제일 안정적 |

**열람 전용이라면 GitSync 부터 시도해보시길 권합니다.** 무료고, 이 저장소가 텍스트 위주로 작아서 모바일 git의 메모리 문제를 건드릴 가능성이 낮습니다. 실제로 자주 죽으면 그때 Obsidian Sync로 넘어가면 됩니다.

**폰을 읽기 전용으로 굳히는 법:** 어느 방법을 쓰든 폰 쪽에서는 **자동 커밋을 끄고 pull만** 돌게 설정하세요. 폰에서 실수로 편집한 게 올라가 PC와 충돌하는 걸 막아줍니다.

---

## 3. 캔버스 경로 설정

`vault/.vaultrc.json` 이 마인드맵 안의 파일 경로를 정합니다.

```json
{ "canvasPathPrefix": "vault/" }
```

| 볼트를 어디로 열었나 | `canvasPathPrefix` |
| --- | --- |
| 저장소 루트 `~/network-oms` (권장, Git 플러그인용) | `"vault/"` |
| `~/network-oms/vault` 직접 | `""` |

바꾼 뒤에는 다시 그려야 합니다.

```bash
npm run vault:build
```

캔버스 안의 링크가 다 깨져 보인다면 십중팔구 이 값이 안 맞는 경우입니다.

---

## 요약

1. `git clone` 하고 **저장소 루트**를 볼트로 연다
2. Obsidian Git 설치, PAT로 인증, auto pull 켜기
3. 폰은 노션으로 읽는다. 마인드맵까지 필요하면 GitSync를 얹는다
