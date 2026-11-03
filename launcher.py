#!/usr/bin/env python3
"""Start Streetlens on loopback using only the Python standard library."""
import argparse
import hashlib
import json
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_ID = "streetlens-local-v1"
HOST = "127.0.0.1"
ASSET_TYPES = {
    "index.html": "text/html; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
    "app.mjs": "text/javascript; charset=utf-8",
    "core.mjs": "text/javascript; charset=utf-8",
    "favicon.svg": "image/svg+xml",
}


def load_assets(base):
    """Support the source repository and the single-HTML download package."""
    base = Path(base)
    assets = {}
    if (base / "dist" / "index.html").is_file():
        for filename, content_type in ASSET_TYPES.items():
            data = (base / "dist" / filename).read_bytes()
            if not data:
                raise OSError("An app asset is empty: " + filename)
            assets["/" + filename] = (data, content_type)
        assets["/"] = assets["/index.html"]
    else:
        html = (base / "Streetlens.html").read_bytes()
        if not html:
            raise OSError("Streetlens.html is empty.")
        assets["/"] = assets["/Streetlens.html"] = (html, "text/html; charset=utf-8")
    digest = hashlib.sha256()
    for route, (data, _) in sorted(assets.items()):
        digest.update(route.encode("utf-8"))
        digest.update(b"\0")
        digest.update(data)
    return assets, digest.hexdigest()


def port_number(value):
    try:
        number = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("The port must be a number.")
    if not 0 <= number <= 65535:
        raise argparse.ArgumentTypeError("Use a port between 1 and 65535 (0 for testing).")
    return number


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def server_bind(self):
        # Windows exclusivity prevents accidentally sharing another app's port.
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class Handler(BaseHTTPRequestHandler):
    server_version = "StreetlensLocal/1.0"

    def __init__(self, *args, assets, fingerprint, **kwargs):
        self.assets = assets
        self.fingerprint = fingerprint
        super().__init__(*args, **kwargs)

    def do_GET(self):
        self.respond(send_body=True)

    def do_HEAD(self):
        self.respond(send_body=False)

    def respond(self, send_body):
        resource = urllib.parse.urlsplit(self.path).path
        if resource in self.assets:
            body, content_type = self.assets[resource]
            status = 200
        elif resource == "/.well-known/streetlens-local":
            body = json.dumps({"app": APP_ID, "fingerprint": self.fingerprint}).encode("utf-8")
            status, content_type = 200, "application/json; charset=utf-8"
        else:
            status, body, content_type = 404, b"Not found", "text/plain; charset=utf-8"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def log_message(self, format, *args):
        # Do not log browser input, URLs, or keys.
        pass


def same_app_running(port, fingerprint):
    if port == 0:
        return False
    try:
        # A configured HTTP proxy must never receive localhost health checks.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(
            "http://{}:{}/.well-known/streetlens-local".format(HOST, port), timeout=0.6
        ) as response:
            result = json.loads(response.read(1024).decode("utf-8"))
        return isinstance(result, dict) and result.get("app") == APP_ID and result.get("fingerprint") == fingerprint
    except (OSError, ValueError, urllib.error.URLError):
        return False


def open_browser(url):
    try:
        if not webbrowser.open(url, new=2):
            print("Browser did not open. Open the Local URL above manually.", flush=True)
    except Exception:
        print("Browser did not open. Open the Local URL above manually.", flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Start the Streetlens local practice app.")
    parser.add_argument("--port", type=port_number, default=4173, help="Local port (default: 4173).")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser.")
    parser.add_argument("--check", action="store_true", help="Check files/runtime without starting a server.")
    args = parser.parse_args(argv)
    try:
        assets, fingerprint = load_assets(Path(__file__).resolve().parent)
    except OSError as error:
        print("[Streetlens] Cannot read the app files: {}".format(error), file=sys.stderr)
        print("Extract the entire ZIP. Keep dist/ or Streetlens.html beside the launcher.", file=sys.stderr)
        return 1
    if args.check:
        print("[Streetlens] OK: Python {}.{}; app files are present ({} bytes).".format(
            sys.version_info.major, sys.version_info.minor, len(assets["/"][0])))
        return 0
    url = "http://{}:{}/".format(HOST, args.port)
    if same_app_running(args.port, fingerprint):
        print("[Streetlens] This app is already running.", flush=True)
        print("Local: " + url, flush=True)
        if not args.no_browser:
            open_browser(url)
        return 0
    try:
        server = LocalServer((HOST, args.port), partial(Handler, assets=assets, fingerprint=fingerprint))
    except OSError as error:
        print("[Streetlens] Cannot start the local server: {}".format(error), file=sys.stderr)
        print("Port {} may already be in use by another app or another version.".format(args.port), file=sys.stderr)
        print("Close that server, or run: start.cmd --port 4174", file=sys.stderr)
        print("If you change the port, add the new URL to your Google API key's website restrictions.", file=sys.stderr)
        return 1
    url = "http://{}:{}/".format(HOST, server.server_port)
    print("\nSTREETLENS - Local geography practice", flush=True)
    print("Local: " + url, flush=True)
    print("Keep this window open. Press Ctrl+C to stop the server.", flush=True)
    print("Connect your Google Maps API key using the app's setup screen.", flush=True)
    print("Required allowed website: " + url + "*\n", flush=True)
    if not args.no_browser:
        # The socket is listening before a browser can request the page.
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\n[Streetlens] Server stopped.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
