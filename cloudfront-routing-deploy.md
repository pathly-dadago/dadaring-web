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
