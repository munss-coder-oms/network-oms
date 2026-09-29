# CLAUDE.md

이 저장소는 음성 생각 정리 파이프라인(Claude + Notion + Obsidian)입니다. 예전에는 `munss-coder-oms/product-builder-munsss` 안에 영상 생성 서버와 같이 있었고, 여기로 옮겨왔습니다.

| 경로 | 무엇 |
| --- | --- |
| `.claude/skills/thought-organizer/` | 진행 절차 스킬 |
| `tools/vault.mjs` | 볼트 CLI (의존성 없음) |
| `vault/` | Obsidian 볼트 (노트와 마인드맵) |
| `docs/` | 사람용 설치·사용 안내 |

## 생각 정리 파이프라인

사용자가 음성으로 쏟아낸 생각을 인터뷰·구조화해서, 상세 기록은 Notion에, 구조와 마인드맵은 `vault/`(Obsidian 볼트)에 남깁니다.

진행 절차는 `.claude/skills/thought-organizer/SKILL.md` 에 있습니다. **생각 정리 요청을 받으면 그 스킬을 먼저 읽고 거기 적힌 순서를 따르세요.** 이 파일에 요약을 중복해 두지 않았습니다.

### 브랜치 규칙

- `vault/` 아래 변경(노트 기록)은 **main 에 직접** 커밋하고 푸시합니다. 사용자가 로컬에서 `git pull` 만으로 노트를 받기 때문입니다.
- 도구·스킬·문서 변경(`tools/`, `.claude/`, `docs/`, `package.json` 등)은 브랜치를 따고 PR 을 만듭니다.

### 볼트 규칙

- 노트는 반드시 `node tools/vault.mjs` 로 만듭니다. 마크다운을 직접 쓰면 프론트매터 스키마가 어긋납니다.
- 마인드맵(`vault/90-Maps/*.canvas`)과 `vault/00-대시보드.md` 는 **자동 생성물**입니다. 손으로 고치지 마세요. 구조를 바꾸려면 노트의 `parents` 를 고치고 다시 생성합니다.
- 캔버스 안의 파일 경로 접두어는 `vault/.vaultrc.json` 의 `canvasPathPrefix` 에서 옵니다. 현재 `"vault/"` — 사용자가 저장소 루트를 Obsidian 볼트로 열기 때문입니다. **임의로 바꾸면 사용자 쪽 캔버스 링크가 전부 깨집니다.**
- 볼트를 건드린 뒤에는 항상 이 순서로 마감합니다.

```bash
npm run vault:build   # canvas + index + check
```

`check` 가 문제를 뱉으면 고치고 다시 돌립니다. 문제가 남은 채로 끝내지 마세요.

### 노션

`.claude/skills/thought-organizer/config.json` 에 적힌 데이터 소스에만 씁니다. 스키마와 페이지 포맷은 `references/notion.md` 를 따릅니다.

`주제` 와 `태그` 는 multi_select라 **스키마에 없는 값을 넘기면 400 에러가 납니다.** 새 주제는 `notion-update-data-source` 로 옵션을 먼저 추가하세요. `ALTER COLUMN ... SET` 은 목록을 통째로 교체하므로 기존 옵션을 전부 다시 나열해야 합니다.

## 공통

- 의존성이 없습니다. `package.json` 에 `dependencies` 를 추가하기 전에 표준 라이브러리로 되는지 먼저 확인하세요.
- 커밋 메시지와 문서는 한국어로 씁니다.
