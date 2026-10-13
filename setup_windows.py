"""Create an isolated environment using only the Python standard library.

Also works on Linux/macOS for repeatable installation verification.
Run setup again after changing requirements.txt. No administrator privileges required.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent


def main() -> int:
    if sys.version_info < (3, 10):
        print("Wymagany Python 3.10 lub nowszy. Zalecany CPython 3.12–3.14 (64-bit).")
        return 1
    env = ROOT / ".venv"
    python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    requirements = ROOT / "requirements.txt"
    stamp = env / "requirements.sha256"
    try:
        digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
        if not python.is_file():
            print("[1/3] Tworzenie srodowiska .venv...", flush=True)
            venv.EnvBuilder(with_pip=True).create(env)
        else:
            print("[1/3] Uzywam istniejacego srodowiska .venv.", flush=True)
        env_vars = os.environ.copy()
        env_vars["PYTHONUTF8"] = "1"
        if not stamp.is_file() or stamp.read_text(encoding="ascii") != digest:
            print("[2/3] Instalowanie zaleznosci (potrzebny internet)...", flush=True)
            subprocess.run(
                [str(python), "-m", "pip", "install", "--disable-pip-version-check",
                 "--only-binary=:all:", "-r", str(requirements)],
                cwd=ROOT, env=env_vars, check=True,
            )
        else:
            print("[2/3] Zaleznosci nie zmienily sie. Sprawdzam instalacje.", flush=True)
        subprocess.run([str(python), "-m", "pip", "check"], cwd=ROOT, env=env_vars, check=True)
        subprocess.run([str(python), "-c", "import flask, waitress"], cwd=ROOT, env=env_vars, check=True)
        print("[3/3] Walidacja gry i modelu gestow...", flush=True)
        subprocess.run([str(python), "run.py", "--check"], cwd=ROOT, env=env_vars, check=True)
        stamp.write_text(digest, encoding="ascii")
    except (OSError, subprocess.CalledProcessError) as exc:
        stamp.unlink(missing_ok=True)
        print(f"\nInstalacja nie powiodla sie: {exc}")
        print("Sprawdz internet i wersje Pythona. Szczegoly: README.md, Rozwiazywanie problemow.")
        return 1
    print("\nGotowe. Windows: uruchom START.cmd. Inne systemy: .venv/bin/python run.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
