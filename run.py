"""Windows-friendly loopback entry point; never exposes the stage controls publicly."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent


def check_assets():
    vendor = ROOT / "neon_pilot/static/vendor"
    manifest = json.loads((vendor / "manifest.json").read_text(encoding="utf-8"))
    for name, info in manifest["files"].items():
        blob = (vendor / name).read_bytes()
        if len(blob) != info["bytes"] or hashlib.sha256(blob).hexdigest() != info["sha256"]:
            raise ValueError(f"Uszkodzony plik kamery: {name}. Rozpakuj oryginalną paczkę ponownie.")


def main():
    parser = argparse.ArgumentParser(description="Neon Pilot — gra sterowana dłonią")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Port musi być w zakresie 1024–65535.")
    try:
        from neon_pilot import create_app
        from waitress import serve
        check_assets()
        if args.check:
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                app = create_app(tmp, testing=True)
                assert app.test_client().get("/").status_code == 200
                app.extensions["neon_log"].close()
            print("OK: Python, aplikacja, model gestów i zasoby lokalne.")
            return 0
        app = create_app()
        url = f"http://127.0.0.1:{args.port}"
        print(f"\nNEON PILOT — {url}\nKamera lub klawiatura. F8: scena. Ctrl+C: koniec.\n",flush=True)
        if not args.no_browser:
            timer = threading.Timer(1.2, lambda: webbrowser.open(url))
            timer.daemon=True
            timer.start()
        serve(app, host="127.0.0.1", port=args.port, threads=4, max_request_body_size=4096)
    except KeyboardInterrupt:
        return 0
    except (OSError, ValueError, ImportError) as exc:
        print(f"Nie udało się uruchomić gry: {exc}\nSprawdź INSTALUJ.cmd i README.md.",file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
