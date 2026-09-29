# 볼트 CLI 레퍼런스

`node tools/vault.mjs <명령> [옵션]` — 의존성 없음, 저장소 루트에서 실행.

공통 옵션: `--vault <경로>` (기본 `vault`)

## capture — 빠른 기록 (주제 자동 매칭·생성)

```bash
node tools/vault.mjs capture --title "서술문 제목" [--topic "주제"] [--text "원문" | --text-file 파일] [옵션]
```

| 옵션 | 설명 |
| --- | --- |
| `--title` | **필수.** 서술문 |
| `--topic` | 주제 이름. 기존 주제의 제목·별칭·파일명과 공백/대소문자/하이픈 차이를 무시하고 맞춘다. 없으면 **주제 허브를 새로 만든다.** 생략하면 `00-Inbox` 로 간다 |
| `--text` / `--text-file` | 사용자가 말한 원문. "말한 그대로" 섹션에 인용으로 들어간다 |
| `--type` | `note`(기본) 또는 `question` |
| `--summary` | 한 문장 요약. "핵심"(질문이면 "왜 이게 궁금한가") 에 들어간다 |
| `--parent` | 상위 노트 제목. 생략하면 주제 허브 |
| `--alias` | 새 주제를 만들 때 붙일 별칭 (쉼표 구분). Obsidian `aliases` 로 저장된다 |
| `--topic-summary` | 새 주제의 한 줄 정의 |
| `--tags` `--confidence` `--session` `--force` | `new` 와 같다 |

부수 효과: 주제 허브 노트의 `## 하위 생각`(질문이면 `## 열린 질문`) 에 `- [[제목]]` 을 덧붙인다.

## topics / match — 주제 고르기

```bash
node tools/vault.mjs topics                          # 주제·별칭·한 줄 정의·노트 수
node tools/vault.mjs match --text-file "$SCRATCH/원문.md"   # 원문과 가까운 주제 후보 5개
```

`match` 점수는 글자 2-gram 겹침(주제 이름·별칭 60%, 한 줄 정의·노트 제목·요약·태그 40%)이다. 참고값일 뿐이니 최종 판단은 내용을 읽고 내린다.

## search — 전문 검색

```bash
node tools/vault.mjs search --q "손절"
```

제목·요약·본문·별칭에서 찾고, 본문에서 걸린 줄을 같이 보여준다.

## export — 주제 한 장으로 묶기

```bash
node tools/vault.mjs export --topic "코인 자동매매" [--out 파일]
```

구조 트리 + 모든 생각 + 열린 질문 + 세션 링크를 한 장짜리 마크다운으로 뽑는다. 새 프로젝트를 시작할 때 Claude 에게 건넬 맥락이다. `--out` 이 없으면 표준출력.

## new — 노트 생성

```bash
node tools/vault.mjs new --type <session|topic|note|question|inbox> --title "..." [옵션]
```

| 옵션 | 설명 |
| --- | --- |
| `--type` | `note` 원자 노트 / `topic` 주제 허브 / `question` 열린 질문 / `session` 세션 원문 / `inbox` 미분류 |
| `--title` | **필수.** 서술문으로. 파일명이 된다 |
| `--topic` | `note` · `question` 은 **필수** |
| `--parent` | 상위 노트 제목. 여러 번 쓸 수 있음. 첫 번째가 마인드맵 간선이 된다 |
| `--alias` | `topic` 만. 별칭(쉼표 구분). `capture`·`new --topic` 이 이 이름으로도 주제를 찾는다 |
| `--tags` | 쉼표 구분 |
| `--status` | `seed`(기본) `growing` `stable` `parked` |
| `--confidence` | `low` `mid`(기본) `high` |
| `--summary` | 한 문장 요약 |
| `--session` | 세션 ID (`YYYYMMDD-HHmm`) |
| `--notion` | 노션 페이지 URL |
| `--body` / `--body-file` | 본문. 생략하면 타입별 기본 골격이 들어간다 |
| `--force` | 같은 경로 파일 덮어쓰기 |

생성 경로:

| type | 경로 |
| --- | --- |
| `topic` | `10-Topics/<제목>.md` |
| `note` | `20-Notes/<주제>/<제목>.md` |
| `question` | `30-Questions/<주제>/<제목>.md` |
| `session` | `40-Sessions/<세션ID>-<제목>.md` |
| `inbox` | `00-Inbox/<제목>.md` |

`--topic` 은 기존 주제의 별칭이나 띄어쓰기만 다른 이름이어도 기존 주제 제목으로 맞춰진다.

**본문은 `--body-file` 로 넘긴다.** 여러 줄·따옴표가 섞이면 셸에서 깨진다. 임시 파일은 스크래치패드 디렉터리에 쓴다.

```bash
cat > "$SCRATCH/body.md" <<'EOF'
# 에이전트는 도구보다 판단이 병목이다

- 주제: [[AI 에이전트]]
- 상위: [[AI 에이전트]]

## 핵심

도구를 20개까지 늘려도 성공률이 안 올랐다. 어떤 도구를 언제 쓸지의 기준이 없으면 개수는 무의미하다.

## 근거 / 맥락

(사용자가 말한 구체적 장면)

## 반론 / 빈 곳

판단 기준을 어떻게 학습시킬지는 아직 모른다 → [[판단 기준을 어떻게 학습시키나]]
EOF

node tools/vault.mjs new --type note --topic "AI 에이전트" \
  --title "에이전트는 도구보다 판단이 병목이다" --parent "AI 에이전트" \
  --body-file "$SCRATCH/body.md"
```

## link — 관계 추가

```bash
node tools/vault.mjs link --from "자식 노트 제목" --to "부모 노트 제목"
```

이미 만든 노트의 `parents` 에 항목을 덧붙인다. 구조를 바꾸고 싶을 때 `.canvas` 대신 이걸 쓴다.

## canvas — 마인드맵 생성

```bash
node tools/vault.mjs canvas                 # 전 주제 + 전체 지도
node tools/vault.mjs canvas --topic "AI 에이전트"
```

- 주제마다 `90-Maps/<주제>.canvas`
- 전 주제 조망용 `90-Maps/_전체지도.canvas`
- `topic` 으로 지도를 고르고, `parents[0]` 으로 트리를 세운다. 부모가 없으면 주제 허브 밑에 붙는다
- 노드 색: 주제 보라, 원자 노트 초록, 열린 질문 주황
- **자동 생성물이다.** 매번 덮어쓰므로 손으로 고치지 않는다
- Obsidian 이 캔버스를 저장할 때 쓰는 서식(탭 들여쓰기, 노드·간선 한 줄씩, 끝 줄바꿈 없음)과 똑같이 쓴다. 그래서 옵시디언에서 지도를 열기만 해서는 git 변경이 생기지 않는다. 옵시디언에서 상자를 옮기면 좌표가 바뀌어 변경이 생기고, 다음 pull 이 충돌할 수 있으니 지도는 보기만 한다

캔버스 안의 파일 경로는 **Obsidian 볼트 루트 기준**이라 앞에 붙일 접두어가 필요하다. `vault/.vaultrc.json` 의 `canvasPathPrefix` 에서 읽으며 (현재 `"vault/"` — 사용자가 저장소 루트를 볼트로 열기 때문), `--path-prefix` 로 덮어쓸 수 있다. **이 값을 임의로 바꾸지 않는다.** 바꾸면 사용자 쪽 캔버스 링크가 전부 깨진다.

노트 본문에서 캔버스를 임베드할 때는 경로 없이 파일명만 쓴다 (`![[주제.canvas]]`). 볼트 루트가 어디든 해석된다.

## index — 대시보드

```bash
node tools/vault.mjs index
```

`vault/00-대시보드.md` 를 다시 만든다. 주제별 노트 수, 열린 질문 목록, 최근 세션(노션 링크 포함).

## check — 검증

```bash
node tools/vault.mjs check
```

- 빠진 `title` / `type` / `topic`
- 존재하지 않는 상위 노트
- 깨진 `[[위키링크]]`
- 허브 노트 없는 주제

문제가 있으면 종료 코드 1. **세션 끝에 반드시 돌리고, 초록이 될 때까지 고친다.**

## list — 목록

```bash
node tools/vault.mjs list                      # 전체
node tools/vault.mjs list --topic "AI 에이전트"
node tools/vault.mjs list --type question      # 열린 질문만
node tools/vault.mjs list --type topic         # 주제 파일 목록 (요약은 topics 가 더 낫다)
node tools/vault.mjs list --type inbox         # 미분류함
```

## 프론트매터 스키마

```yaml
---
title: 에이전트는 도구보다 판단이 병목이다   # 노트 제목 = 링크 대상
type: note                                   # session|topic|note|question|inbox
topic: AI 에이전트                            # 어느 지도에 속하는가
id: 20260809-1432
created: 2026-08-09T14:32
updated: 2026-08-09T14:32
status: seed                                 # seed|growing|stable|parked
confidence: mid                              # low|mid|high
parents:                                     # [0] 이 마인드맵 간선
  - AI 에이전트
aliases:                                     # topic 만. 다른 이름으로도 찾아진다
  - 에이전트
tags:
  - 설계
session: 20260809-1432                       # 노션 "세션 ID" 와 동일
notion: https://app.notion.com/p/...
summary: 도구를 늘려도 성능이 안 오르는 이유는 판단 기준의 부재다
---
```
