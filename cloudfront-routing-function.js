// CloudFront Function — path rewriting for dadaring-web.
//
// Reason: the S3 origin doesn't serve directory-style URLs like /invite/CODE.
// Without this function, /invite/CODE returns 403 → falls through to /index.html
// (the marketing page) via CustomErrorResponses. We rewrite these paths so the
// correct HTML files are served from S3 while the browser URL stays the same.
//
// Deploy via aws cloudfront create-function + publish-function + update-distribution.
// See cloudfront-routing-deploy.md for steps.

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // /invite/<code>  →  serve /invite.html  (code visible to client-side JS via window.location.pathname)
    if (uri.match(/^\/invite\/[A-Z0-9]+$/i)) {
        request.uri = '/invite.html';
    }
    // /get-app  →  /get-app.html  (pretty URL alias)
    else if (uri === '/get-app' || uri === '/app') {
        request.uri = '/get-app.html';
    }

    return request;
}
