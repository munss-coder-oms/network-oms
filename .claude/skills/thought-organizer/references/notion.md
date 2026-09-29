# Notion 기록 규칙

세션마다 **생각 로그** 데이터베이스에 페이지 하나를 만든다. ID는 `config.json` 의 `notion.dataSourceId`.

Obsidian은 요약된 구조를 담고, **Notion은 잃어버리면 안 되는 원본**을 담는다. 원문·질문·답변을 빠짐없이 넣는다.

## 데이터베이스 스키마

| 프로퍼티 | 타입 | 채우는 값 |
| --- | --- | --- |
| `제목` | title | `YYYY-MM-DD <주제> — <한 줄 요지>` |
| `날짜` | date | `date:날짜:start` 에 `YYYY-MM-DD` |
| `유형` | select | `세션` / `주제` / `원자노트` / `열린질문` — 세션 페이지는 `세션` |
| `주제` | multi_select | 볼트의 `topic` 값과 **똑같이** 쓴다 |
| `상태` | select | `씨앗` / `성장중` / `정리됨` / `보류` |
| `확신도` | select | `낮음` / `중간` / `높음` |
| `태그` | multi_select | 자유 |
| `핵심 요약` | text | 한 문장 |
| `다음 질문` | text | 다음에 팔 질문 하나 |
| `옵시디언 경로` | text | `40-Sessions/20260809-1432-....md` |
| `세션 ID` | text | `YYYYMMDD-HHmm` — 볼트 프론트매터 `session` 과 동일 |

볼트의 `status` / `confidence` 와 노션 값의 대응:

| 볼트 | 노션 |
| --- | --- |
| `seed` / `growing` / `stable` / `parked` | `씨앗` / `성장중` / `정리됨` / `보류` |
| `low` / `mid` / `high` | `낮음` / `중간` / `높음` |

## 페이지 본문 템플릿

`notion-create-pages` 의 `content` 에 아래 구조를 그대로 채워 넣는다.

```markdown
## 한 줄 요지

(핵심 판단 한 문장)

## 말한 내용 (원문)

(1단계에서 받아 적은 것. 요약하지 않는다. 말투도 그대로.)

## 되비춘 요약

- (핵심 주장 1)
- (핵심 주장 2)

> 사용자 정정: (있으면 여기에. 없으면 "없음")

## 갈래치기 · 층 나누기

| 조각 | 층 | 메모 |
| --- | --- | --- |
| ... | 사실 | ... |
| ... | 판단 | ... |

## 인터뷰

**Q. (질문)**
A. (사용자 답변 원문)

**Q. (질문)**
A. (답 못 함 → 열린 질문으로 이관)

## 구조화 결과

- **주제**: AI 에이전트
  - 에이전트는 도구보다 판단이 병목이다 — `20-Notes/AI-에이전트/에이전트는-도구보다-판단이-병목이다.md`
    - (질문) 판단 기준을 어떻게 학습시키나 — `30-Questions/...`

## 마무리 3줄

- 확정된 판단: ...
- 가장 확신 없는 지점: ...
- 다음에 팔 질문: ...

## 링크

- Obsidian 세션 노트: `40-Sessions/....md`
- Obsidian 지도: `90-Maps/<주제>.canvas`
```

## 호출 예시

```
notion-create-pages
  parent: { type: "data_source_id", data_source_id: "<config.json 의 dataSourceId>" }
  pages: [{
    icon: "🧠",
    properties: {
      "제목": "2026-08-09 AI 에이전트 — 도구보다 판단이 병목이다",
      "date:날짜:start": "2026-08-09",
      "유형": "세션",
      "주제": ["AI 에이전트"],
      "상태": "씨앗",
      "확신도": "중간",
      "핵심 요약": "...",
      "다음 질문": "...",
      "옵시디언 경로": "40-Sessions/20260809-1432-....md",
      "세션 ID": "20260809-1432"
    },
    content: "..."
  }]
```

## 새 주제·태그를 쓸 때 (중요)

`주제` 와 `태그` 는 `multi_select` 이고, **스키마에 없는 옵션을 넘기면 400 에러가 난다.** 자동 생성되지 않는다.

```
Invalid multi_select value for property "주제": "...". Value must be one of the following: ...
```

새 주제를 처음 기록할 때는 페이지를 만들기 **전에** 옵션을 먼저 추가한다. `ALTER COLUMN ... SET` 은 목록을 통째로 교체하므로 **기존 옵션을 전부 다시 나열해야 한다** — 빠뜨리면 기존 페이지의 값이 사라진다. 현재 옵션은 `notion-fetch` 로 데이터 소스를 읽어 확인한다.

```
notion-update-data-source
  data_source_id: "<config.json 의 dataSourceId>"
  statements: ALTER COLUMN "주제" SET MULTI_SELECT('미분류':gray, '기존주제':purple, '새주제':blue)
```

색은 `default, gray, brown, orange, yellow, green, blue, purple, pink, red` 중에서 고른다.

## 주의

- `config.json` 에 적힌 데이터베이스 외의 노션 페이지를 만들거나 수정하지 않는다.
- 같은 세션을 두 번 기록하지 않는다. 이어서 얘기하는 중이면 `notion-update-page` 의 `insert_content` 로 덧붙인다.
- 페이지를 만든 뒤 반환된 URL을 볼트 세션 노트의 `notion:` 프론트매터에 반드시 반영한다.
