# CloudFront Function — 라우팅 배포 가이드

`cloudfront-routing-function.js`를 CloudFront에 한 번만 배포 (코드 변경 시 update + publish).

## 최초 배포 (한 번)

```bash
# 1. Function 생성
aws --profile dadago cloudfront create-function \
  --name dadaring-web-routing \
  --function-config Comment="Path rewriting for invite and get-app URLs",Runtime=cloudfront-js-2.0 \
  --function-code fileb://cloudfront-routing-function.js

# 출력에서 ETag 메모 (publish 시 필요)

# 2. Function publish (TESTING → LIVE 단계로 전환)
aws --profile dadago cloudfront publish-function \
  --name dadaring-web-routing \
  --if-match <ETag>

# 3. Distribution 설정에 Function 연결
# 현재 prod distribution ID: E1LHYXQO70K3I1
aws --profile dadago cloudfront get-distribution-config \
  --id E1LHYXQO70K3I1 > /tmp/dist-config.json

# 4. /tmp/dist-config.json 편집:
#    "DefaultCacheBehavior" 객체에 다음 추가:
#    "FunctionAssociations": {
#      "Quantity": 1,
#      "Items": [{
#        "FunctionARN": "arn:aws:cloudfront::604509502616:function/dadaring-web-routing",
#        "EventType": "viewer-request"
#      }]
#    }

# 5. 업데이트
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-update.json

aws --profile dadago cloudfront update-distribution \
  --id E1LHYXQO70K3I1 \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/dist-update.json

# 6. CloudFront invalidation (캐시 비우기)
aws --profile dadago cloudfront create-invalidation \
  --distribution-id E1LHYXQO70K3I1 --paths "/*"
```

## 함수 코드 업데이트 시

```bash
aws --profile dadago cloudfront update-function \
  --name dadaring-web-routing \
  --function-config Comment="...",Runtime=cloudfront-js-2.0 \
  --function-code fileb://cloudfront-routing-function.js \
  --if-match <ETag from describe-function>

aws --profile dadago cloudfront publish-function \
  --name dadaring-web-routing \
  --if-match <new ETag>
```

## 동작 확인

배포 후 (전파 5-10분):
- `https://www.dadaring.com/invite/ABC123` — invite.html 응답 (1941 bytes 정도)
- `https://www.dadaring.com/get-app` — get-app.html 응답
- `https://www.dadaring.com/` — index.html (변경 없음)
- `https://www.dadaring.com/.well-known/apple-app-site-association` — JSON 응답 (Universal Links 검증용)

## 참고

- CloudFront Function은 viewer-request에서 실행 → S3에 요청 도달하기 전 URI 재작성
- `event.request.uri` 변경 시 브라우저 URL은 그대로 (사용자에게 보이는 URL 유지)
- Function 런타임 cloudfront-js-2.0 사용 (최신 ES 문법 지원)
- 함수 크기 제한: 10KB (현재 함수 ~500B로 여유 큼)

## 2026-07-21 블로그 출시 — 필요한 수동 배포 2가지

블로그 pretty URL(`/blog`, `/blog/<slug>`)과 소프트 404 제거를 위해 한 번 더 수동 배포 필요.

### 1. 함수 코드 업데이트 (위 "함수 코드 업데이트 시" 절차 그대로)

변경 내용: 확장자 없는 경로 → `.html` 일반 규칙 (`/blog/<slug>`, `/get-app`, `/privacy` 등 자동 처리),
끝 슬래시 → `index.html`. 이후 글/섹션이 늘어도 함수 재배포 불필요.

```bash
ETAG=$(aws --profile dadago cloudfront describe-function --name dadaring-web-routing --query 'ETag' --output text)
aws --profile dadago cloudfront update-function \
  --name dadaring-web-routing \
  --function-config Comment="Pretty URL rewriting (generalized)",Runtime=cloudfront-js-2.0 \
  --function-code fileb://cloudfront-routing-function.js \
  --if-match $ETAG
# 출력의 새 ETag로:
aws --profile dadago cloudfront publish-function --name dadaring-web-routing --if-match <새 ETag>
```

### 2. CustomErrorResponse 403 → 404.html (소프트 404 제거, SEO)

기존: 없는 경로가 홈페이지를 200으로 응답 (구글이 soft-404 로 판정, 색인 품질 저하).
변경: `404.html`을 404 코드로 응답. `cloudfront-prod.json` 참조가 이미 반영된 상태.

```bash
aws --profile dadago cloudfront get-distribution-config --id E1LHYXQO70K3I1 > /tmp/dist-config.json
# CustomErrorResponses 항목을 ResponseCode "404", ResponsePagePath "/404.html" 로 수정 후:
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-update.json
aws --profile dadago cloudfront update-distribution --id E1LHYXQO70K3I1 --distribution-config file:///tmp/dist-update.json --if-match $ETAG
```

### 배포 후 확인

- `https://dadaring.com/blog` — 블로그 목록
- `https://dadaring.com/blog/widget-home-screen` — 1호 글
- `https://dadaring.com/blog/no-such-post` — 404.html + HTTP 404
- `https://dadaring.com/invite/ABC123` — 기존대로 invite.html
