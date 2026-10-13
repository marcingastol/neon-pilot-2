"""Local game server. Camera frames and gesture inference stay in the browser."""
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
import hmac
import json
import logging
from logging.handlers import RotatingFileHandler
import math
import mimetypes
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit

from flask import Flask, jsonify, render_template, request, g
from werkzeug.exceptions import HTTPException

VERSION = "1.0.0"
DEFAULTS = {"shield_enabled": True, "ranking_fault": False}
MAX_SCORE = 12000


def create_app(data_dir=None, testing=False):
    mimetypes.add_type("text/javascript", ".mjs")
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("application/wasm", ".wasm")
    app = Flask(__name__)
    app.config.update(TESTING=testing, DEBUG=False, MAX_CONTENT_LENGTH=4096,
                      TRUSTED_HOSTS=["localhost", "127.0.0.1", "[::1]"])
    data = Path(data_dir) if data_dir else Path(__file__).resolve().parents[1] / "data"
    data.mkdir(parents=True, exist_ok=True)
    database = data / "ranking.sqlite3"
    settings_file = data / "stage.json"
    lock = threading.RLock()
    events = deque(maxlen=40)
    token = secrets.token_urlsafe(32)
    config = dict(DEFAULTS)
    if settings_file.exists():
        saved = json.loads(settings_file.read_text(encoding="utf-8"))
        if not isinstance(saved, dict) or any(type(saved.get(k)) is not bool for k in DEFAULTS):
            raise ValueError("Niepoprawny data/stage.json. Przywróć wartości true/false.")
        config.update({k: saved[k] for k in DEFAULTS})

    log = logging.getLogger(f"neon.{id(app)}")
    log.setLevel(logging.INFO)
    log.propagate = False
    handler = RotatingFileHandler(data / "events.log", maxBytes=500_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))
    log.addHandler(handler)
    app.extensions["neon_log"] = handler

    def event(code, detail, request_id=None):
        item = dict(at=datetime.now(timezone.utc).isoformat(timespec="seconds"), code=code,
                    detail=detail, request_id=request_id)
        with lock:
            events.append(item)
            log.info(json.dumps(item, ensure_ascii=False))

    @contextmanager
    def connect():
        con = sqlite3.connect(database, timeout=5)
        con.row_factory = sqlite3.Row
        try:
            with con:
                yield con
        finally:
            con.close()

    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY, started REAL NOT NULL, mode TEXT NOT NULL, control TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scores (
          id INTEGER PRIMARY KEY, run_id TEXT UNIQUE NOT NULL REFERENCES runs(id),
          name TEXT NOT NULL, score INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL,
          created REAL NOT NULL, mode TEXT NOT NULL, control TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS rank_order ON scores(mode, control, score DESC, created);
        """)

    def public_config():
        with lock:
            return dict(config, version=VERSION, duration=60, shield_seconds=3, cooldown_seconds=10)

    def fail(message, code, status):
        return jsonify(error=message, code=code, request_id=g.request_id), status

    @app.before_request
    def protect():
        g.request_id = secrets.token_hex(6)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("Origin")
            if origin and origin != request.host_url.rstrip("/"):
                return fail("Żądanie z innej strony zostało odrzucone.", "ORIGIN_REJECTED", 403)
            if request.headers.get("Sec-Fetch-Site") == "cross-site":
                return fail("Otwórz grę pod jej lokalnym adresem.", "ORIGIN_REJECTED", 403)
            if not hmac.compare_digest(request.headers.get("X-Neon-Token", ""), token):
                return fail("Odśwież stronę po ponownym uruchomieniu serwera.", "TOKEN_REQUIRED", 403)
            if not request.is_json:
                return fail("Wymagany format JSON.", "JSON_REQUIRED", 415)

    @app.after_request
    def headers(response):
        response.headers.update({
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; "
                "worker-src 'self'; style-src 'self'; img-src 'self' data:; "
                "media-src 'self' blob:; connect-src 'self'; object-src 'none'; "
                "frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
            "Cache-Control": "no-store", "X-Request-ID": getattr(g, "request_id", "")
        })
        return response

    @app.errorhandler(HTTPException)
    def http_error(exc):
        return jsonify(error="Nieprawidłowe żądanie.", code=f"HTTP_{exc.code}"), exc.code

    @app.errorhandler(sqlite3.Error)
    def db_error(exc):
        event("RANKING_DATABASE_ERROR", type(exc).__name__, g.request_id)
        return fail("Ranking chwilowo niedostępny. Spróbuj ponownie.", "RANKING_DATABASE_ERROR", 503)

    @app.get("/")
    def index():
        return render_template("index.html", token=token, version=VERSION)

    @app.get("/healthz")
    def health():
        return jsonify(status="ok", version=VERSION)

    @app.get("/api/config")
    def get_config():
        return jsonify(public_config())

    @app.post("/api/stage")
    def stage():
        body = request.get_json()
        if not isinstance(body, dict) or not body or not set(body) <= set(DEFAULTS) or any(type(v) is not bool for v in body.values()):
            return fail("Ustawienia sceniczne muszą być wartościami true/false.", "INVALID_SETTINGS", 400)
        with lock:
            updated = dict(config, **body)
            tmp = settings_file.with_suffix(".tmp")
            try:
                tmp.write_text(json.dumps(updated, indent=2) + "\n", encoding="utf-8")
                tmp.replace(settings_file)
            except OSError:
                event("SETTINGS_WRITE_FAILED", "Nie udało się zapisać data/stage.json", g.request_id)
                return fail("Nie można zapisać ustawień.", "SETTINGS_WRITE_FAILED", 503)
            config.update(updated)
            event("STAGE_CHANGED", json.dumps(body), g.request_id)
        return jsonify(public_config())

    @app.get("/api/events")
    def get_events():
        with lock:
            return jsonify(events=list(events)[-20:])

    @app.post("/api/runs")
    def new_run():
        body = request.get_json()
        if not isinstance(body, dict) or body.get("control") not in ("camera", "keyboard"):
            return fail("Wybierz kamerę albo klawiaturę.", "INVALID_CONTROL", 400)
        current = public_config()
        mode = "shield" if current["shield_enabled"] else "classic"
        run_id = secrets.token_urlsafe(24)
        with connect() as db:
            db.execute("DELETE FROM runs WHERE started < ? AND id NOT IN (SELECT run_id FROM scores)", (time.time()-7200,))
            db.execute("INSERT INTO runs VALUES(?,?,?,?)", (run_id, time.time(), mode, body["control"]))
        return jsonify(run_id=run_id, config=current, mode=mode), 201

    @app.get("/api/scores")
    def scores():
        if config["ranking_fault"]:
            return fail("Ranking wyłączony w ćwiczeniu scenicznym.", "DEMO_RANKING_OFFLINE", 503)
        mode = request.args.get("mode", "shield")
        control = request.args.get("control", "keyboard")
        if mode not in ("shield", "classic") or control not in ("camera", "keyboard"):
            return fail("Nieznana kategoria rankingu.", "INVALID_CATEGORY", 400)
        with connect() as db:
            rows = db.execute("SELECT name, score, elapsed_ms FROM scores WHERE mode=? AND control=? ORDER BY score DESC, created ASC LIMIT 5", (mode,control)).fetchall()
            count = db.execute("SELECT COUNT(*) FROM scores WHERE mode=? AND control=?", (mode,control)).fetchone()[0]
        return jsonify(scores=[dict(r) for r in rows], count=count, mode=mode, control=control)

    @app.post("/api/scores")
    def save_score():
        body = request.get_json()
        if not isinstance(body, dict):
            return fail("Brak wyniku.", "INVALID_SCORE", 400)
        name, score, elapsed, run_id = (body.get(k) for k in ("name", "score", "elapsed_ms", "run_id"))
        if (not isinstance(name,str) or not 1 <= len(name.strip()) <= 20
            or any(not (c.isalnum() or c in " _-.") for c in name.strip())
            or type(score) is not int or not 0 <= score <= MAX_SCORE
            or type(elapsed) is not int or not 0 <= elapsed <= 60100
            or not isinstance(run_id,str) or not re.fullmatch(r"[A-Za-z0-9_-]{32}",run_id)):
            return fail("Podaj pseudonim (1–20 znaków) i poprawny wynik.", "INVALID_SCORE", 400)
        if config["ranking_fault"]:
            event("DEMO_RANKING_OFFLINE", "Kontrolowana usterka: ranking_fault=true; POST /api/scores odrzucony. Wynik pozostał w przeglądarce.", g.request_id)
            return fail("Ćwiczenie: zapis rankingu jest wyłączony. Napraw go w panelu F8 i ponów zapis.", "DEMO_RANKING_OFFLINE", 503)
        with connect() as db:
            row = db.execute("SELECT * FROM runs WHERE id=?",(run_id,)).fetchone()
            if row is None or time.time()-row["started"] > 7200:
                return fail("Sesja wyniku wygasła. Rozpocznij nową rundę.", "RUN_EXPIRED", 400)
            if elapsed > (time.time()-row["started"])*1000 + 2000:
                return fail("Czas rundy jest niepoprawny.", "INVALID_DURATION", 400)
            db.execute("INSERT OR IGNORE INTO scores(run_id,name,score,elapsed_ms,created,mode,control) VALUES(?,?,?,?,?,?,?)",
                (run_id,name.strip(),score,elapsed,time.time(),row["mode"],row["control"]))
            saved = db.execute("SELECT name,score FROM scores WHERE run_id=?",(run_id,)).fetchone()
        event("SCORE_SAVED", f"score={saved['score']}; mode={row['mode']}; control={row['control']}", g.request_id)
        return jsonify(saved=True, name=saved["name"], score=saved["score"])

    event("SERVER_STARTED", f"Neon Pilot {VERSION}; localhost only; gesture inference in browser")
    return app
