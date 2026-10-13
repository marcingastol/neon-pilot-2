"""Create a separate, incomplete exercise copy without changing the working game.

Usage: python tools/prepare_live_demo.py ../neon-pilot-live
The acceptance tests intentionally fail until Copilot implements Shield.input.
"""
from pathlib import Path
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]

def main():
    if len(sys.argv)!=2:
        print("Użycie: python tools/prepare_live_demo.py ../neon-pilot-live")
        return 1
    target=Path(sys.argv[1]).resolve()
    if target.exists() or target==ROOT or ROOT in target.parents:
        print("Wskaż NOWY folder poza katalogiem gotowej gry. Nic nie zmieniono.")
        return 1
    source=(ROOT/'neon_pilot/static/rules.mjs').read_text(encoding='utf-8')
    start=source.index('  input(pressed, now) {')
    end=source.index('  active(now)',start)
    replacement='''  input(pressed, now) {
    // ĆWICZENIE: Copilot ma zaimplementować aktywację tarczy.
    // Wymagania: 3 s ochrony; 10 s między aktywacjami; wymagany nowy gest.
    this.held = pressed;
    return false;
  }
'''
    shutil.copytree(ROOT,target,ignore=shutil.ignore_patterns('.venv','.git','data','__pycache__','*.pyc'))
    (target/'neon_pilot/static/rules.mjs').write_text(source[:start]+replacement+source[end:],encoding='utf-8')
    app=target/'neon_pilot/__init__.py'
    app.write_text(app.read_text(encoding='utf-8').replace('DEFAULTS = {"shield_enabled": True,','DEFAULTS = {"shield_enabled": False,'),encoding='utf-8')
    (target/'EXERCISE.txt').write_text('To kopia do ćwiczenia live coding. Tarcza jest celowo niezaimplementowana. Testy jej aktywacji mają być czerwone. Działająca wersja pozostała w pierwotnym folderze.\n',encoding='utf-8')
    print(f"Utworzono ćwiczenie: {target}\nUruchom w nim INSTALUJ.cmd. Szczegóły: docs/DEMO.md")
    return 0

if __name__=='__main__':raise SystemExit(main())
