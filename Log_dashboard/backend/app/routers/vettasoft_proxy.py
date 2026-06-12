"""Reverse proxy for VettaSoft telemetry (first-party cookies in iframe embeds)."""

from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlparse

from pathlib import Path

import httpx
from fastapi import APIRouter, Request, Response

router = APIRouter(prefix="/vettasoft", tags=["vettasoft"])

UPSTREAM_HOST = "telemetria.vettasoft.com"
PROXY_PREFIX = "/vettasoft"
EMBED_CSS_URL = f"{PROXY_PREFIX}/_embed/custom.css"
EMBED_CSS_FILE = Path(__file__).resolve().parents[2] / "static" / "vettasoft_embed.css"

HOP_BY_HOP_HEADERS = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-length",
        "content-encoding",
    }
)

# Upstream caches static assets for 1 year; stale JS breaks proxied URL rewrites.
CACHE_HEADERS = frozenset({"cache-control", "etag", "last-modified", "expires", "age"})

# Known VettaSoft API path prefixes — do NOT use a broad `"/..."` rewrite:
# it breaks regex literals like .replace(/"/g, ...) in utils.js / selectize / ace.
_QUOTED_API_PATH = re.compile(r'(["\'])/(api/|widgets/)')
_TEMPLATE_VAR_PATH = re.compile(r"`/\$\{(\w+)\}/")
_CSS_URL_PATH = re.compile(
    r"(\burl\(\s*[\"']?)/(static/|api/|widgets/)",
    re.IGNORECASE,
)

_ROOT_RELATIVE_ATTRS = ("href", "action", "src", "formaction")
_REDIRECT_INPUT = re.compile(
    r'(<input[^>]*type=["\']hidden["\'][^>]*value=["\'])(/)(["\'][^>]*name=["\']redirect["\'])',
    re.IGNORECASE,
)
_REDIRECT_INPUT_ALT = re.compile(
    r'(<input[^>]*name=["\']redirect["\'][^>]*value=["\'])(/)(["\'])',
    re.IGNORECASE,
)
_HEAD_CLOSE = re.compile(r"</head>", re.IGNORECASE)
_BODY_CLOSE = re.compile(r"</body>", re.IGNORECASE)

# jQuery hook: VettaSoft API richiede X-API-KEY (= session), ma session e' HttpOnly.
_EMBED_JS = """<script data-vettasoft-embed="1">
(function(){function apiKey(){var m=document.cookie.match(/(?:^|; )vettasoft_api_key=([^;]*)/);return m?decodeURIComponent(m[1]):"";}
if(typeof jQuery!=="undefined"){jQuery(document).ajaxSend(function(_e,xhr){var key=apiKey();if(key)xhr.setRequestHeader("X-API-KEY",key);});}
})();
</script>"""

_I18N_STUB = b"var i18n_strings = {};\n"


def _replace_upstream_host(text: str) -> str:
    text = text.replace(f"https://{UPSTREAM_HOST}/", f"{PROXY_PREFIX}/")
    return text.replace(f"http://{UPSTREAM_HOST}/", f"{PROXY_PREFIX}/")


def _rewrite_js_urls(text: str) -> str:
    text = _replace_upstream_host(text)
    text = _QUOTED_API_PATH.sub(rf"\1{PROXY_PREFIX}/\2", text)
    return _TEMPLATE_VAR_PATH.sub(rf"`{PROXY_PREFIX}/${{\1}}/", text)


def _rewrite_css_urls(text: str) -> str:
    text = _replace_upstream_host(text)
    return _CSS_URL_PATH.sub(rf"\1{PROXY_PREFIX}/\2", text)


def _rewrite_html_urls(text: str) -> str:
    text = _rewrite_js_urls(text)
    for attr in _ROOT_RELATIVE_ATTRS:
        text = re.sub(
            rf'({attr}=["\'])/(?!vettasoft/)',
            rf"\1{PROXY_PREFIX}/",
            text,
            flags=re.IGNORECASE,
        )
    text = _CSS_URL_PATH.sub(rf"\1{PROXY_PREFIX}/\2", text)
    text = _REDIRECT_INPUT.sub(rf"\1{PROXY_PREFIX}/\3", text)
    return _REDIRECT_INPUT_ALT.sub(rf"\1{PROXY_PREFIX}/\3", text)


def _strip_proxy_prefix(path: str) -> str:
    while path.startswith(PROXY_PREFIX):
        path = path[len(PROXY_PREFIX):] or "/"
    return path


def _rewrite_location(value: str) -> str:
    if value.startswith("/"):
        return f"{PROXY_PREFIX}{_strip_proxy_prefix(value)}"
    parsed = urlparse(value)
    if parsed.netloc == UPSTREAM_HOST:
        path = _strip_proxy_prefix(parsed.path or "/")
        query = f"?{parsed.query}" if parsed.query else ""
        return f"{PROXY_PREFIX}{path}{query}"
    return value


def _client_is_https(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    if forwarded:
        return forwarded == "https"
    return request.url.scheme == "https"


def _session_from_cookie(cookie_header: str) -> str | None:
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("session="):
            return part[len("session="):]
    return None


def _session_value_from_set_cookie(set_cookie: str) -> str | None:
    first = set_cookie.split(";")[0].strip()
    if not first.lower().startswith("session="):
        return None
    return first.split("=", 1)[1]


def _companion_api_key_set_cookie(session_value: str, *, client_https: bool) -> str:
    parts = [f"vettasoft_api_key={session_value}", "Path=/", "SameSite=Lax"]
    if client_https:
        parts.append("Secure")
    return "; ".join(parts)


def _rewrite_set_cookie(value: str, *, client_https: bool) -> str:
    parts = [part.strip() for part in value.split(";") if part.strip()]
    kept: list[str] = []
    has_samesite = False
    for part in parts:
        lower = part.lower()
        if lower.startswith("domain="):
            continue
        # VettaSoft always marks session Secure; browsers reject that on plain HTTP
        # except localhost — production (e.g. 172.20.x.x) needs Secure stripped.
        if not client_https and lower == "secure":
            continue
        if not client_https and lower.startswith("samesite=none"):
            part = "SameSite=Lax"
        if lower.startswith("samesite="):
            has_samesite = True
        kept.append(part)
    if not client_https and not has_samesite:
        kept.append("SameSite=Lax")
    return "; ".join(kept)


def _inject_embed_assets(html: str) -> str:
    if "data-vettasoft-embed" in html:
        return html
    link = f'<link rel="stylesheet" href="{EMBED_CSS_URL}" data-vettasoft-embed="1">'
    html = _HEAD_CLOSE.sub(f"{link}</head>", html, count=1)
    return _BODY_CLOSE.sub(f"{_EMBED_JS}</body>", html, count=1)


def _rewrite_html(text: str) -> str:
    text = _rewrite_html_urls(text)
    return _inject_embed_assets(text)


def _rewrite_form_body_to_upstream(body: bytes, content_type: str) -> bytes:
    """Strip /vettasoft from form fields before forwarding to VettaSoft."""
    if "application/x-www-form-urlencoded" not in content_type.lower():
        return body
    pairs = parse_qsl(body.decode("utf-8"), keep_blank_values=True)
    rewritten: list[tuple[str, str]] = []
    for key, value in pairs:
        if key == "redirect":
            value = _strip_proxy_prefix(value)
        rewritten.append((key, value))
    return urlencode(rewritten).encode("utf-8")


def _should_rewrite_body(content_type: str, content: bytes) -> bool:
    lowered = content_type.lower()
    if not any(
        token in lowered
        for token in ("text/html", "text/css", "javascript", "application/json")
    ):
        return False
    # Skip binary payloads (e.g. brotli/gzip not decoded).
    if content[:2] == b"\x1f\x8b" or content[:3] == b"\x1b\xb3\x10":
        return False
    try:
        content[:512].decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def _response_headers(upstream: httpx.Response, *, client_https: bool) -> Iterable[tuple[str, str]]:
    for key, value in upstream.headers.multi_items():
        lowered = key.lower()
        if lowered in HOP_BY_HOP_HEADERS or lowered in CACHE_HEADERS:
            continue
        if lowered == "location":
            yield key, _rewrite_location(value)
        elif lowered == "set-cookie":
            yield key, _rewrite_set_cookie(value, client_https=client_https)
            session_value = _session_value_from_set_cookie(value)
            if session_value is not None:
                if session_value:
                    yield key, _companion_api_key_set_cookie(session_value, client_https=client_https)
                else:
                    yield key, "vettasoft_api_key=; Path=/; Max-Age=0; SameSite=Lax"
        else:
            yield key, value
    yield "Cache-Control", "no-store, no-cache, must-revalidate"
    yield "Pragma", "no-cache"


@router.get("/_embed/custom.css")
def vettasoft_embed_css() -> Response:
    css = EMBED_CSS_FILE.read_text(encoding="utf-8") if EMBED_CSS_FILE.is_file() else ""
    return Response(
        content=css,
        media_type="text/css; charset=utf-8",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_vettasoft(path: str, request: Request) -> Response:
    upstream_path = f"/{path}" if path else "/"
    upstream_url = f"https://{UPSTREAM_HOST}{upstream_path}"
    if request.url.query:
        upstream_url = f"{upstream_url}?{request.url.query}"

    client_https = _client_is_https(request)

    forward_headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lowered = key.lower()
        if lowered in HOP_BY_HOP_HEADERS or lowered in ("host", "accept-encoding"):
            continue
        forward_headers[key] = value
    forward_headers["Host"] = UPSTREAM_HOST

    # VettaSoft API expects X-API-KEY (= session); HttpOnly cookie is invisible to JS.
    if not any(k.lower() == "x-api-key" for k in forward_headers):
        session = request.cookies.get("session") or _session_from_cookie(
            request.headers.get("cookie", "")
        )
        if session:
            forward_headers["X-API-KEY"] = session

    body = await request.body()
    request_content_type = request.headers.get("content-type", "")
    if body:
        body = _rewrite_form_body_to_upstream(body, request_content_type)

    async with httpx.AsyncClient(follow_redirects=False, timeout=60.0) as client:
        upstream = await client.request(
            request.method,
            upstream_url,
            headers=forward_headers,
            content=body if body else None,
        )

    content = upstream.content
    content_type = upstream.headers.get("content-type", "")
    i18n_stub = path == "api/i18n.js" and upstream.status_code == 401

    if i18n_stub:
        content = _I18N_STUB
    elif _should_rewrite_body(content_type, content):
        text = content.decode("utf-8", errors="replace")
        lowered = content_type.lower()
        if "text/html" in lowered:
            text = _rewrite_html(text)
        elif "javascript" in lowered:
            text = _rewrite_js_urls(text)
        elif "text/css" in lowered:
            text = _rewrite_css_urls(text)
        elif "application/json" in lowered:
            text = _replace_upstream_host(text)
        content = text.encode("utf-8")

    response = Response(
        content=content,
        status_code=200 if i18n_stub else upstream.status_code,
        media_type="application/javascript; charset=utf-8" if i18n_stub else None,
    )
    for key, value in _response_headers(upstream, client_https=client_https):
        if i18n_stub and key.lower() in ("content-type", "content-length"):
            continue
        if key.lower() == "set-cookie":
            response.headers.append("set-cookie", value)
        else:
            response.headers[key] = value
    return response
