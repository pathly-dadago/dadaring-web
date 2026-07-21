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
    // /app  →  /get-app.html  (short alias; no app.html exists)
    else if (uri === '/app') {
        request.uri = '/get-app.html';
    }
    // section root without slash  (/blog → /blog/index.html)
    else if (uri === '/blog') {
        request.uri = '/blog/index.html';
    }
    // trailing slash → directory index  (/ → /index.html, /blog/ → /blog/index.html)
    else if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    }
    // extensionless page → .html  (/get-app, /blog/<slug>, /privacy, ...)
    else if (!uri.split('/').pop().includes('.')) {
        request.uri = uri + '.html';
    }

    return request;
}
