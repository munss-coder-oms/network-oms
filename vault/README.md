---
title: 볼트 안내
type: index
---

# 🧠 생각 볼트

노트가 사는 곳입니다. Obsidian에서는 **이 폴더가 아니라 한 단계 위 저장소 루트**를 볼트로 여세요. Obsidian Git 플러그인이 git 저장소를 찾으려면 그래야 합니다. 자세한 절차는 [../docs/setup-obsidian.md](../docs/setup-obsidian.md).

## 폴더 구조

| 폴더 | 담는 것 |
| --- | --- |
| `00-Inbox/` | 아직 주제가 안 정해진 조각 생각 |
| `10-Topics/` | 주제 허브 노트 (MOC). 마인드맵의 중심이 됩니다 |
| `20-Notes/<주제>/` | 원자 노트 — 생각 하나 = 파일 하나 |
| `30-Questions/<주제>/` | 아직 답 못 낸 열린 질문 |
| `40-Sessions/` | 음성 세션 원문 정리 (노션 상세 기록으로 링크) |
| `90-Maps/` | 자동 생성되는 `.canvas` 마인드맵 |
| `_templates/` | Obsidian 템플릿 |

`00-대시보드.md` 는 `node tools/vault.mjs index` 가 자동 생성합니다.

## 마인드맵이 만들어지는 원리

각 노트의 프론트매터에 있는 `topic` 과 `parents` 가 곧 그래프의 간선입니다.

```yaml
---
title: 에이전트는 도구보다 판단이 병목이다
type: note
topic: AI 에이전트
parents:
  - 에이전트 설계의 어려움
status: growing
---
```

- `topic` → 어느 지도에 들어갈지
- `parents` → 그 지도 안에서 누구 밑에 붙을지

`node tools/vault.mjs canvas` 를 돌리면 주제마다 `90-Maps/<주제>.canvas` 가, 그리고 전체를 조망하는 `90-Maps/_전체지도.canvas` 가 다시 그려집니다. 캔버스는 **자동 생성물**이라 직접 고쳐도 다음 실행 때 덮어써집니다. 구조를 바꾸고 싶으면 노트의 `parents` 를 고치세요.

## 노트 상태값

| `status` | 뜻 |
| --- | --- |
| `seed` | 방금 말로 뱉은 씨앗. 아직 검증 안 됨 |
| `growing` | 몇 번 더 파본 생각 |
| `stable` | 정리가 끝나 당분간 안 바뀔 생각 |
| `parked` | 지금은 안 볼 생각 |

`confidence` 는 `low` / `mid` / `high` 로, 그 생각을 얼마나 믿는지 표시합니다.

## 추천 플러그인

- **Canvas** (내장) — 마인드맵 보기
- **Graph view** (내장) — 링크 전체 조망
- **Dataview** (선택) — `status: seed` 인 노트만 모아보기 등

## 로컬에서 쓰기

```bash
git clone https://github.com/munss-coder-oms/network-oms.git ~/network-oms
# Obsidian → 폴더를 볼트로 열기 → ~/network-oms  (vault 폴더가 아님)
git pull   # 세션 후 최신 노트 받아오기
```

`.vaultrc.json` 의 `canvasPathPrefix` 가 볼트를 어디로 열었는지에 맞아야 캔버스 링크가 살아 있습니다.
저장소 루트를 열었으면 `"vault/"`, 이 폴더를 직접 열었으면 `""` 로 두고 `npm run vault:build` 를 다시 돌리세요.
