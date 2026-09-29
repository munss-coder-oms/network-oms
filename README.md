# 생각 정리 (network-oms)

말로 뱉은 생각을 Claude가 인터뷰·정리해서, 구조와 마인드맵은 Obsidian 볼트(`vault/`)에, 상세 기록은 Notion에 쌓는 저장소입니다.

| 도구 | 역할 |
| --- | --- |
| Claude | 분석, 인터뷰, 진행, 기록 |
| Obsidian (`vault/`) | 주제별 노트, 파일 구조, `.canvas` 마인드맵 |
| Notion | 세션별 상세 기록 |

## 로컬에서 보기

```bash
git clone https://github.com/munss-coder-oms/network-oms.git ~/network-oms
```

Obsidian → **폴더를 볼트로 열기** → `~/network-oms` (저장소 루트. `vault/` 가 아닙니다).
Claude가 노트를 기록한 뒤에는 `git pull` 만 하면 최신 노트와 지도가 들어옵니다.

- 대시보드: `vault/00-대시보드.md`
- 전체 지도: `vault/90-Maps/_전체지도.canvas`

자세한 설치·사용법은 `docs/` 에 있습니다.
