import contextlib
import importlib.util
import io
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("streetlens_launcher", ROOT / "launcher.py")
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assets, cls.fingerprint = launcher.load_assets(ROOT)
        cls.server = launcher.LocalServer(
            (launcher.HOST, 0),
            partial(launcher.Handler, assets=cls.assets, fingerprint=cls.fingerprint),
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = "http://127.0.0.1:{}/".format(cls.server.server_port)
        cls.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self, path="", method="GET"):
        return self.opener.open(urllib.request.Request(self.url + path, method=method), timeout=3)

    def test_app_served_from_any_working_directory(self):
        with self.request() as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), (ROOT / "dist" / "index.html").read_bytes())
            self.assertIn("text/html", response.headers["Content-Type"])
            self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_javascript_modules_have_a_javascript_mime_type(self):
        for name in ("app.mjs", "core.mjs"):
            with self.request(name) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("text/javascript", response.headers["Content-Type"])
                self.assertTrue(response.read())

    def test_head_returns_headers_without_body(self):
        with self.request(method="HEAD") as response:
            self.assertEqual(response.read(), b"")
            self.assertGreater(int(response.headers["Content-Length"]), 100)

    def test_server_exposes_only_web_assets(self):
        for name in ("launcher.py", "start.cmd", ".env", "../README.md", "dist/../launcher.py"):
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request(name)
            self.assertEqual(error.exception.code, 404)
            error.exception.close()

    def test_fingerprint_identifies_this_exact_app(self):
        with self.request(".well-known/streetlens-local") as response:
            marker = json.loads(response.read())
        self.assertEqual(marker["app"], launcher.APP_ID)
        self.assertEqual(marker["fingerprint"], self.fingerprint)
        self.assertTrue(launcher.same_app_running(self.server.server_port, self.fingerprint))
        self.assertFalse(launcher.same_app_running(self.server.server_port, "other-version"))

    def test_a_second_start_reuses_the_running_app_without_a_new_server(self):
        with patch.object(launcher.webbrowser, "open") as browser:
            with contextlib.redirect_stdout(io.StringIO()) as output:
                code = launcher.main(["--port", str(self.server.server_port), "--no-browser"])
        self.assertEqual(code, 0)
        self.assertIn("already running", output.getvalue())
        browser.assert_not_called()
        with self.request() as response:
            self.assertEqual(response.status, 200)

    def test_another_version_is_not_reused_or_terminated(self):
        handler = partial(launcher.Handler, assets=self.assets, fingerprint="another-version")
        server = launcher.LocalServer((launcher.HOST, 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with contextlib.redirect_stderr(io.StringIO()) as output:
                code = launcher.main(["--port", str(server.server_port), "--no-browser"])
            self.assertEqual(code, 1)
            self.assertIn("already be in use", output.getvalue())
            self.assertTrue(thread.is_alive())
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)

    def test_check_does_not_start_a_server_or_browser(self):
        with patch.object(launcher.webbrowser, "open") as browser:
            with contextlib.redirect_stdout(io.StringIO()) as output:
                code = launcher.main(["--check"])
        self.assertEqual(code, 0)
        self.assertIn("OK:", output.getvalue())
        browser.assert_not_called()

    def test_single_html_package_is_supported(self):
        with tempfile.TemporaryDirectory(prefix="streetlens-test-") as temporary:
            base = Path(temporary).resolve()
            self.assertEqual(base.parent, Path(tempfile.gettempdir()).resolve())
            (base / "Streetlens.html").write_text("<!doctype html><title>Test</title>", encoding="utf-8")
            assets, fingerprint = launcher.load_assets(base)
            self.assertEqual(assets["/"], assets["/Streetlens.html"])
            self.assertEqual(len(fingerprint), 64)

    def test_browser_opens_the_exact_local_url(self):
        with patch.object(launcher.webbrowser, "open", return_value=True) as browser:
            launcher.open_browser(self.url)
        browser.assert_called_once_with(self.url, new=2)


if __name__ == "__main__":
    unittest.main()
