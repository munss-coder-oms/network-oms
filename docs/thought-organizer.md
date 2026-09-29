# 🧠 생각 정리 (Thought Organizer)

음성으로 말한 생각을 Claude가 인터뷰·분석해서, **상세 기록은 Notion에**, **구조와 마인드맵은 Obsidian에** 남기는 시스템.

| 도구 | 역할 |
| --- | --- |
| Claude | 분석, 인터뷰, 진행 |
| Notion | 세션별 상세 기록 (원문·질문·답변 전부) |
| Obsidian (`vault/`) | 원자 노트, 파일 구조, `.canvas` 마인드맵 |

## 쓰는 법

Claude Code(앱·웹·CLI)에서 마이크를 켜고 말하면 됩니다.

```
/thought-organizer
```

또는 그냥 **"생각 좀 정리하자"** 하고 말을 쏟아내면 스킬이 알아서 붙습니다.

그러면 Claude가 이 순서로 진행합니다.

1. **수집** — 자르지 않고 다 듣습니다
2. **되비추기** — 들은 걸 3~5줄로 요약해 확인받습니다
3. **인터뷰** — 빈 곳을 캐묻습니다 (한 번에 3개 이하)
4. **구조화** — 생각을 원자 단위로 쪼개고 트리로 보여줍니다
5. **기록** — Obsidian 노트 + Notion 페이지 생성
6. **시각화** — `.canvas` 마인드맵과 대시보드 재생성
7. **커밋** — 볼트를 git에 저장하고 결과를 보고

## 처음 한 번: 로컬에 볼트 연결하기

```bash
git clone https://github.com/munss-coder-oms/network-oms.git ~/network-oms
```

Obsidian → **폴더를 볼트로 열기** → **`~/network-oms`** 선택. (`~/network-oms/vault` 가 아닙니다 — Obsidian Git 플러그인은 git 저장소가 볼트 안에 있어야 동작합니다.)

세션이 끝나고 Claude가 push하면, 로컬에서 `git pull` 하면 최신 노트와 지도가 들어옵니다.

PC 설치·Git 플러그인 설정·폰 열람까지 전체 절차는 **[docs/setup-obsidian.md](setup-obsidian.md)** 에 있습니다.

## 정리 방법론 바꾸기

`.claude/skills/thought-organizer/references/method.md` 가 **인터뷰 흐름을 정의하는 파일**입니다.

지금은 기본 골격(뱉기 → 갈래치기 → 층 나누기 → 캐묻기 → 압축)이 들어 있습니다.
배워온 방법이 따로 있다면 이 파일을 통째로 바꾸세요. 기록·시각화 단계는 그대로 동작합니다.

바꿀 때 각 단계마다 이 세 가지를 명시하면 됩니다.

- 그 단계에서 **무엇을 하는지**
- 사용자에게 **무슨 질문을 던지는지**
- 그 단계의 **산출물**이 원자 노트인지·열린 질문인지·주제인지

## 볼트 구조

```
vault/
├── 00-대시보드.md          # 자동 생성
├── 00-Inbox/               # 주제 미정 조각
├── 10-Topics/              # 주제 허브 (마인드맵 중심)
├── 20-Notes/<주제>/        # 원자 노트 — 생각 하나 = 파일 하나
├── 30-Questions/<주제>/    # 열린 질문
├── 40-Sessions/            # 세션 원문 (노션으로 링크)
├── 90-Maps/                # .canvas 마인드맵 (자동 생성)
└── _templates/
```

마인드맵은 각 노트 프론트매터의 `topic`(어느 지도에) 과 `parents`(누구 밑에) 로부터 만들어집니다.
**`.canvas` 는 자동 생성물**이라 손으로 옮겨도 다음 실행에 덮어써집니다. 구조를 바꾸려면 `parents` 를 고치세요.

## 말 한마디만 던질 때

인터뷰까지 갈 것 없이 **"이거 적어둬: ..."** 하고 말하면 Claude가 제목과 들어갈 주제를 한 줄로 확인받은 뒤 바로 기록합니다.

- 기존 주제에 맞으면 거기에, 맞는 게 없으면 **주제를 새로 만들어** 넣습니다. 별칭이나 띄어쓰기가 달라도 같은 주제로 찾습니다.
- 주제를 못 정하면 `00-Inbox` 로 가고 대시보드의 "미분류" 에 뜹니다.
- 말한 원문은 노트의 "말한 그대로" 섹션에 인용으로 남습니다.

## 아이디어를 프로젝트로 꺼내기

**"코인 자동매매 주제로 프로젝트 시작하자"** 처럼 말하면 Claude가 그 주제를 한 장으로 묶어(`export`) 맥락으로 씁니다. 구조 트리, 모든 생각, 열린 질문, 노션 세션 링크가 들어갑니다.

## CLI

```bash
npm run vault -- capture --topic "주제" --title "서술문" --text "원문"   # 주제 자동 매칭·생성
npm run vault -- topics                   # 주제 목록
npm run vault -- match --text "..."       # 원문과 가까운 주제 후보
npm run vault -- search --q "키워드"
npm run vault -- export --topic "주제" --out 묶음.md
npm run vault -- new --type note --topic "주제" --title "제목" --parent "상위 노트"
npm run vault -- link --from "자식" --to "부모"
npm run vault -- list --type question     # 열린 질문 모아보기
npm run vault:build                       # 지도 + 대시보드 재생성 + 검증
```

전체 옵션은 `.claude/skills/thought-organizer/references/vault.md` 참고. 의존성 없이 Node 20+ 만 있으면 됩니다.

## Notion

- 홈: [🧠 생각 정리 (Thought Organizer)](https://app.notion.com/p/3b74c44d2ebc814da58cfe8e9aabcd5a)
- DB: [생각 로그](https://app.notion.com/p/b35f031bdba74f6990c1d941b7714521)

세션마다 페이지 하나가 쌓입니다. ID는 `.claude/skills/thought-organizer/config.json` 에 있습니다.

`주제` 와 `태그` 는 multi_select라 **새 값은 스키마에 먼저 추가**해야 합니다 (스킬이 자동으로 처리합니다).

## 지금 들어 있는 샘플

`생각 정리 시스템` 주제와 그에 딸린 노트 4개, 세션 1개는 **동작 예시**입니다.
본인 생각으로 채우기 시작하면 지워도 됩니다.

```bash
rm -rf "vault/10-Topics/생각-정리-시스템.md" "vault/20-Notes/생각-정리-시스템" \
       "vault/30-Questions/생각-정리-시스템" vault/40-Sessions/20260809-*
npm run vault:build
```

노션 샘플 페이지도 DB에서 지우면 됩니다.
