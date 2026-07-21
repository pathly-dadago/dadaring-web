# 다다링 홈페이지 블로그 탭 — 디자인 스펙

날짜: 2026-07-21
상태: 사용자 구두 승인 (대화에서 설계 합의)

## 목적

오가닉 마케팅의 콘텐츠 허브. 주 1회 특장점 시리즈 글을 자사 홈페이지에 원본(canonical)으로
발행하고, 이를 기반으로 네이버 블로그(변형 게재), 인스타그램(카드뉴스), 스레드/X(짧은 글)로
확산한다. 검색 노출(SEO)이 최우선 목표.

## 범위

### 홈페이지 (dadaring-web, 이 repo)

- `blog/index.html` — 글 목록 페이지 (카드형, 최신순)
- `blog/<slug>.html` — 개별 글. 슬러그는 영문 케밥 케이스 (예: `widget-home-screen`)
- `css/blog.css` — 블로그 전용 스타일. 기존 `style.css`의 브랜드 토큰(변수) 재사용
- `index.html` — nav·footer에 "블로그" 링크 추가
- `sitemap.xml`, `robots.txt` — 신설. 새 글마다 sitemap에 1줄 추가
- `cloudfront-routing-function.js` — `/blog` → `/blog/index.html`, `/blog/<slug>` →
  `/blog/<slug>.html` 리라이트 추가 (배포는 기존 cloudfront-routing-deploy.md 절차)

### SEO 요구사항 (글마다)

- `<title>`: 검색 키워드 포함 (예: "아이 일정 관리", "학원 시간표")
- meta description, OG 태그, canonical URL (`https://dadaring.com/blog/<slug>`)
- JSON-LD `BlogPosting` (headline, datePublished, image, publisher)
- 이미지: 기존 `images/shot-*.png` 재사용, alt 텍스트 필수
- 글 하단 CTA: 스토어 다운로드 버튼

### 콘텐츠 워크플로우 (주 1회)

1. 홈페이지 글 HTML 작성 → PR → 사용자 main 머지 (머지 즉시 배포)
2. `marketing/<date>-<slug>/naver.md` — 네이버 블로그 붙여넣기용 원고 (네이버 검색 문법 변형)
3. `marketing/<date>-<slug>/threads.md` — 스레드/X 짧은 글 2~3개
4. 인스타 카드뉴스 5~7장 — HTML 카드 → headless Chrome 1080×1350 PNG,
   `marketing/<date>-<slug>/instagram/`에 저장
5. 업로드(네이버/인스타/스레드)는 사용자가 직접

`*.md`는 deploy.yml의 S3 sync에서 제외되므로 marketing 원고는 공개되지 않음.
단, `marketing/` 하위 PNG는 제외 규칙이 없으므로 deploy.yml에 `--exclude "marketing/*"` 추가.

### 주차별 주제 (합의된 순서)

위젯 → AR 영어독서 → 알림장 AI → 학원 일정 → 학원비 → 가족 공유 → 다이어리 → 완료 캘린더

## 비범위

- 정적 사이트 생성기/빌드 도구 도입 (순수 HTML 유지)
- 댓글, RSS, 태그/카테고리 (글이 쌓이면 재검토)
- 유료 광고

## 사용자 액션 아이템

- CloudFront 함수 재배포 (cloudfront-routing-deploy.md 절차)
- 네이버 블로그·인스타·스레드 계정 생성
- 네이버 서치어드바이저 + 구글 서치콘솔 등록 (sitemap 제출)
- PR 머지 및 채널별 업로드
