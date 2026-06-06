# pyright: reportAttributeAccessIssue=false, reportIncompatibleMethodOverride=false
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import local_auth_proxy


class FakeResponse:
    status = 200
    reason = "OK"

    def read(self, _limit=None):
        return b'{"status":"ok"}'


class FakeConnection:
    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.closed = False
        self.requests = []

    def request(self, method, path, headers=None):
        self.requests.append((method, path, headers or {}))

    def getresponse(self):
        return FakeResponse()

    def close(self):
        self.closed = True


class LocalAuthProxyTests(unittest.TestCase):
    def test_target_health_uses_ops_console_api_health(self):
        with patch.object(local_auth_proxy.http.client, "HTTPConnection", FakeConnection):
            result = local_auth_proxy.check_target_health()

        self.assertEqual(result["statusCode"], 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["bytes"], len(b'{"status":"ok"}'))

    def test_health_payload_is_bounded_and_secret_free(self):
        class Handler(local_auth_proxy.Proxy):
            def __init__(self):
                self.wfile = io.BytesIO()
                self.headers = {}
                self.responses = []

            def send_response(self, code, message=None):
                self.responses.append((code, message))

            def send_header(self, key, value):
                self.responses.append((key, value))

            def end_headers(self):
                self.responses.append(("end", None))

        handler = Handler()
        with patch.object(local_auth_proxy, "check_target_health", return_value={"ok": True, "statusCode": 200, "bytes": 15}):
            handler.health()

        payload = json.loads(handler.wfile.getvalue().decode("utf-8"))
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["service"], "company-ops-console-proxy")
        self.assertEqual(payload["target"]["port"], local_auth_proxy.TARGET_PORT)
        self.assertNotIn("operator", json.dumps(payload).lower())
        self.assertNotIn("email", json.dumps(payload).lower())


if __name__ == "__main__":
    unittest.main()
