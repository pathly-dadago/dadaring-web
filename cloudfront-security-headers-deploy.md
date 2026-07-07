# CloudFront — 보안 헤더 (Response Headers Policy) 배포 가이드

`dadaring.com` 응답에 HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, CSP 5종을 강제 주입.

> 2026-07-07: 관리자 페이지(admin.html)용으로 connect-src 에 cognito-idp + API GW(prod/dev) 추가.

- **Policy 이름:** `dadaring-web-security-headers`
- **Policy ID:** `edc7b320-d4fe-4530-875a-4f878e84282f`
- **Prod Distribution ID:** `E1LHYXQO70K3I1`

## 최초 배포 (이미 완료, 참고용)

```bash
# 1. Policy 정의 파일 작성
cat > /tmp/response-headers-policy.json <<'EOF'
{
  "Name": "dadaring-web-security-headers",
  "Comment": "HSTS + nosniff + Referrer-Policy + CSP for dadaring.com",
  "SecurityHeadersConfig": {
    "StrictTransportSecurity": {
      "Override": true,
      "AccessControlMaxAgeSec": 31536000,
      "IncludeSubdomains": true,
      "Preload": true
    },
    "ContentTypeOptions": { "Override": true },
    "ReferrerPolicy": {
      "Override": true,
      "ReferrerPolicy": "strict-origin-when-cross-origin"
    },
    "FrameOptions": {
      "Override": true,
      "FrameOption": "DENY"
    },
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self' https://vk5y4us4uxvs6lebtogalyloua0ttbte.lambda-url.ap-northeast-2.on.aws https://cognito-idp.ap-northeast-2.amazonaws.com https://dnbl3bo4eg.execute-api.ap-northeast-2.amazonaws.com https://c5gye4ook6.execute-api.ap-northeast-2.amazonaws.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    }
  }
}
EOF

# 2. Policy 생성
aws --profile dadago cloudfront create-response-headers-policy \
  --response-headers-policy-config file:///tmp/response-headers-policy.json

# 출력 .ResponseHeadersPolicy.Id 메모

# 3. Distribution에 attach
aws --profile dadago cloudfront get-distribution-config \
  --id E1LHYXQO70K3I1 > /tmp/dist-config.json
DIST_ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
POLICY_ID="edc7b320-d4fe-4530-875a-4f878e84282f"

jq --arg pid "$POLICY_ID" \
  '.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId = $pid | .DistributionConfig' \
  /tmp/dist-config.json > /tmp/dist-update.json

aws --profile dadago cloudfront update-distribution \
  --id E1LHYXQO70K3I1 \
  --if-match "$DIST_ETAG" \
  --distribution-config file:///tmp/dist-update.json

# 4. 캐시 비우기
aws --profile dadago cloudfront create-invalidation \
  --distribution-id E1LHYXQO70K3I1 --paths "/*"
```

## CSP 정책 설명

```
default-src 'self';
script-src 'self' 'unsafe-inline';                     # invite.html, get-app.html의 <script> 인라인 블록 허용
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;  # 인라인 style + Pretendard 폰트 CSS
font-src 'self' https://cdn.jsdelivr.net data:;        # 폰트 + 폴백 data URI
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';                                 # X-Frame-Options: DENY와 동일 효과 (현대 브라우저)
base-uri 'self';
form-action 'self';
```

- 외부 CDN(`cdn.jsdelivr.net`) 추가/제거 시 style-src와 font-src 함께 수정
- 인라인 스크립트가 더 이상 필요 없어지면 `'unsafe-inline'`을 script-src에서 제거 (XSS 위험 감소)

## 정책 업데이트 시

```bash
# 현재 ETag 조회
aws --profile dadago cloudfront get-response-headers-policy \
  --id edc7b320-d4fe-4530-875a-4f878e84282f

# 정책 본문 수정 후
aws --profile dadago cloudfront update-response-headers-policy \
  --id edc7b320-d4fe-4530-875a-4f878e84282f \
  --if-match <ETag> \
  --response-headers-policy-config file:///tmp/response-headers-policy.json

# CSP 변경은 즉시 반영되나, CloudFront edge 캐시는 invalidation 필요
aws --profile dadago cloudfront create-invalidation \
  --distribution-id E1LHYXQO70K3I1 --paths "/*"
```

## 동작 확인

전파 5~10분 후:

```bash
curl -sI https://www.dadaring.com/ | grep -iE 'strict-transport|x-content|referrer-policy|x-frame|content-security'
```

기대 결과 (5개 헤더 모두 표시):

```
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
x-frame-options: DENY
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
```

## 정책 분리 (Detach)

```bash
# Distribution config에서 ResponseHeadersPolicyId 필드 제거 후 update-distribution
aws --profile dadago cloudfront get-distribution-config --id E1LHYXQO70K3I1 > /tmp/dist-config.json
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
jq 'del(.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId) | .DistributionConfig' \
  /tmp/dist-config.json > /tmp/dist-update.json
aws --profile dadago cloudfront update-distribution \
  --id E1LHYXQO70K3I1 --if-match "$ETAG" \
  --distribution-config file:///tmp/dist-update.json
```
