from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import json
import os
from urllib.parse import urlsplit, urlunsplit

TARGET_HOST = os.getenv("OPS_CONSOLE_TARGET_HOST", "127.0.0.1")
TARGET_PORT = int(os.getenv("OPS_CONSOLE_TARGET_PORT", "3000"))
LISTEN_HOST = os.getenv("OPS_CONSOLE_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.getenv("OPS_CONSOLE_PROXY_PORT", "3010"))
OPERATOR_EMAIL = os.getenv("OPS_CONSOLE_OPERATOR_EMAIL", "operator@example.invalid")
_ALLOWED_CLIENTS = os.getenv("OPS_CONSOLE_ALLOWED_CLIENTS", "127.0.0.1,::1")
ALLOWED_CLIENTS = {ip.strip() for ip in _ALLOWED_CLIENTS.split(",") if ip.strip()}


def is_loopback_host(host):
    name = (host or "").split(":", 1)[0].strip("[]")
    return name in {"127.0.0.1", "localhost", "::1"}


def rewrite_location(value, request_host):
    if not value:
        return value
    parsed = urlsplit(value)
    target_netloc = f"{TARGET_HOST}:{TARGET_PORT}"
    listen_netloc = f"127.0.0.1:{LISTEN_PORT}"
    if parsed.netloc not in {
        target_netloc,
        f"127.0.0.1:{TARGET_PORT}",
        f"localhost:{TARGET_PORT}",
        listen_netloc,
        f"localhost:{LISTEN_PORT}",
    }:
        return value
    if is_loopback_host(request_host):
        return value
    return urlunsplit(("https", request_host, parsed.path, parsed.query, parsed.fragment))


def check_target_health():
    conn = http.client.HTTPConnection(TARGET_HOST, TARGET_PORT, timeout=3)
    try:
        conn.request("GET", "/api/health", headers={"Host": f"{TARGET_HOST}:{TARGET_PORT}"})
        resp = conn.getresponse()
        data = resp.read(2048)
        return {
            "ok": 200 <= resp.status < 400,
            "statusCode": resp.status,
            "reason": resp.reason,
            "bytes": len(data),
        }
    except OSError as exc:
        return {"ok": False, "error": exc.__class__.__name__}
    finally:
        conn.close()


class Proxy(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/health":
            self.health()
            return
        self.forward()

    def do_HEAD(self):
        if self.path.split("?", 1)[0] == "/health":
            self.health(send_body=False)
            return
        self.forward()

    def do_POST(self):
        self.forward()

    def do_PUT(self):
        self.forward()

    def do_PATCH(self):
        self.forward()

    def do_DELETE(self):
        self.forward()

    def health(self, send_body=True):
        target = check_target_health()
        status_code = 200 if target.get("ok") else 503
        payload = {
            "status": "ok" if target.get("ok") else "degraded",
            "service": "company-ops-console-proxy",
            "target": {
                "host": TARGET_HOST,
                "port": TARGET_PORT,
                **target,
            },
        }
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data) if send_body else 0))
        self.end_headers()
        if send_body:
            self.wfile.write(data)

    def forward(self):
        client_ip = self.client_address[0]
        if ALLOWED_CLIENTS and client_ip not in ALLOWED_CLIENTS:
            self.send_response(403, "Forbidden")
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", "9")
            self.end_headers()
            self.wfile.write(b"Forbidden")
            print(f"blocked client {client_ip}", flush=True)
            return

        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in {"host", "connection", "content-length", "accept-encoding"}
        }
        headers["Host"] = f"{TARGET_HOST}:{TARGET_PORT}"
        headers["x-ops-operator-email"] = OPERATOR_EMAIL
        if body is not None:
            headers["Content-Length"] = str(len(body))

        conn = http.client.HTTPConnection(TARGET_HOST, TARGET_PORT, timeout=30)
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
            self.send_response(resp.status, resp.reason)
            request_host = self.headers.get("host") or f"{LISTEN_HOST}:{LISTEN_PORT}"
            for k, v in resp.getheaders():
                lower = k.lower()
                if lower in {"connection", "transfer-encoding", "content-encoding", "content-length"}:
                    continue
                if lower == "location":
                    v = rewrite_location(v, request_host)
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        finally:
            conn.close()

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}", flush=True)


if __name__ == "__main__":
    print(
        f"Ops Console local proxy: http://{LISTEN_HOST}:{LISTEN_PORT} -> "
        f"http://{TARGET_HOST}:{TARGET_PORT} with x-ops-operator-email; "
        f"allowed_clients={','.join(sorted(ALLOWED_CLIENTS)) or 'any'}",
        flush=True,
    )
    ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Proxy).serve_forever()
