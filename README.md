# Neon Pilot — steruj grą dłonią

Gotowa lokalna gra do pokazu na scenie. Python obsługuje aplikację, ranking i logi.
Przeglądarka rysuje grę i rozpoznaje gesty z kamery. Runda trwa maksymalnie 60 sekund.

## Uruchomienie na Windowsie

Wymagane: Python 3.10 lub nowszy z pip/venv, aktualny Microsoft Edge lub Chrome,
kamerka (opcjonalnie), internet do pierwszej instalacji pakietów Python.
Praktyczny wybór: standardowy CPython 3.12–3.14, 64-bit.

1. Rozpakuj cały ZIP do folderu, np. `C:\Demos\neon-pilot`.
2. Uruchom **INSTALUJ.cmd** i poczekaj na komunikat „Gotowe”.
3. Uruchom **START.cmd**. Pozostaw jego okno otwarte.
4. Gra otworzy się pod **http://127.0.0.1:8001**.
5. Możesz od razu grać strzałkami. Aby sterować dłonią, kliknij **Kamera**
   i zezwól przeglądarce na dostęp do kamery.

Nie potrzebujesz Node.js, npm, Gita, Dockera, WSL, konta Azure ani klucza do modelu AI.
Model i pliki MediaPipe są już w paczce. Po instalacji gra działa bez internetu.
Obraz z kamery jest przetwarzany na laptopie; nie trafia do backendu ani do chmury.

Przy kolejnych uruchomieniach wystarczy START.cmd. Serwer zatrzymasz przez Ctrl+C.
Nie uruchamiaj plików wewnątrz ZIP-a. Po przeniesieniu folderu usuń wyłącznie
jego `.venv` i ponownie uruchom instalator, bo środowiska venv nie są przenośne.

### Instalacja ręczna w PowerShell

W folderze zawierającym `run.py`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe run.py --check
.\.venv\Scripts\python.exe run.py
```

Jeśli nie masz launchera `py`, w pierwszym poleceniu użyj `python`.
Aktywowanie środowiska ani zmiana Execution Policy nie są potrzebne.

## Jak grać

- **Cel:** przetrwaj 60 sekund, zbieraj zieloną energię, omijaj pomarańczowe przeszkody.
- **Sterowanie dłonią:** pokaż jedną zamkniętą dłoń i ruszaj nią w lewo/prawo.
  Obraz jest lustrzany: ruch w prawo przesuwa statek w prawo.
- **Tarcza:** otwórz dłoń; przy klawiaturze naciśnij Spację. Ochrona trwa 3 sekundy.
  Kolejna aktywacja jest możliwa po 10 sekundach od poprzedniej i wymaga nowego gestu
  albo ponownego naciśnięcia. Ciągłe trzymanie nie przedłuża tarczy.
- **Klawiatura:** strzałki lewo/prawo lub A/D. Zmianę sterowania wykonuj przed rundą.
- **P:** pauza. **F:** pełny ekran. **F8:** panel sceniczny.
- Masz **3 życia**. Zniknięcie dłoni z kadru wstrzymuje grę. Powrót dłoni ją wznawia,
  chyba że wcześniej włączyłeś ręczną pauzę.
- Przejście do innego okna pauzuje grę. Po powrocie naciśnij P.
- Dźwięk można włączyć przyciskiem w prawym górnym rogu; domyślnie jest wyłączony.

Punkty: +10 za pełną sekundę lotu, +100 za energię, +25 za przeszkodę zablokowaną
tarczą. Po rundzie wpisz pseudonim i zapisz wynik. Ranking pokazuje pięć najlepszych
wyników w wybranej kategorii. Kategorie kamery/klawiatury i z tarczą/bez tarczy są
rozdzielone. Wyniki są prawdziwe; nie ma wpisów demonstracyjnych.

## Kamera na scenie

Ustaw laptop tak, aby kamera widziała dłoń na tle innym niż skóra. Dłoń powinna
mieścić się w całości w kadrze i być dobrze oświetlona. Sprawdź gest otwarcia
i zamknięcia w podglądzie przed rundą. Warto zacząć próbę w odległości około
0,5–1 m i dostosować ją do swojej kamery.

Na projektorze pokaż okno gry w pełnym ekranie. Przetestuj ustawienie kamery
i światło w sali. Sterowanie klawiaturą jest pełną alternatywą, gdy warunki
oświetleniowe utrudniają śledzenie. Testy reguł gry nie gwarantują rozpoznania
każdego gestu w dowolnych warunkach.

## Panel sceniczny i demonstracja dla Copilota

F8 otwiera dwa przełączniki i dziennik zdarzeń:

1. **Tarcza ochronna** — wybór wersji bazowej albo wersji z gotową tarczą.
   Ustawienie tarczy obowiązuje od kolejnej rundy.
2. **Kontrolowana usterka rankingu** — prawdziwa odpowiedź HTTP 503 przy odczycie
   i zapisie wyników. Błąd jest logowany i pokazany w interfejsie. Po wyłączeniu
   usterki można ponowić zapis tego samego wyniku; nie pojawią się duplikaty.

Przełącznik jest pomocą do próby: **nie udaje wdrożenia nowego kodu**.
Do rzeczywistego live coding dołączono generator oddzielnej kopii ćwiczeniowej
z brakującą implementacją tarczy. Przebieg, prompty i instrukcja są w **docs/DEMO.md**.

## Pliki i dane

| Plik | Zastosowanie |
| --- | --- |
| `run.py` | Lokalny start Waitress i kontrola integralności modelu |
| `neon_pilot/__init__.py` | Flask, API, SQLite, ustawienia i logi |
| `neon_pilot/static/rules.mjs` | Reguły gry i tarczy, niezależne od kamery |
| `neon_pilot/static/camera.mjs` | Kamera, gesty, wygładzanie i utrata śledzenia |
| `neon_pilot/static/vision-worker.js` | Rozpoznawanie gestów poza głównym wątkiem gry |
| `neon_pilot/static/renderer.mjs` | Grafika, animacje i efekty Canvas |
| `neon_pilot/static/app.mjs` | Interfejs i komunikacja z API |
| `neon_pilot/static/vendor/` | MediaPipe, WASM, model, licencja i manifest hashy |
| `data/ranking.sqlite3` | Prawdziwy ranking, tworzony przy starcie |
| `data/stage.json` | Zapisane przełączniki sceniczne |
| `data/events.log` | Rotowany dziennik bez obrazu i pseudonimów |
| `.github/workflows/ci.yml` | Automatyczna kontrola Python i reguł gry |

Dane pozostają w folderze `data`. Nie usuwaj go przy aktualizacji, jeśli chcesz
zachować ranking. Pseudonim pamięta również przeglądarka. Nie są gromadzone nagrania.

## Praktyki implementacyjne

Izolowane venv, przypięte zależności z hashami SHA-256, Waitress zamiast serwera developerskiego,
brak debuggera, rozdzielenie reguł gry od UI, walidacja wejścia, parametryzowane
zapytania SQLite, unikalny identyfikator rundy i idempotentny zapis wyniku.
Serwer sprawdza Host, Origin i token chroniący operacje zapisu. CSP dopuszcza
lokalne skrypty i WebAssembly potrzebne modelowi. Pliki modelu mają kontrolę SHA-256.
Narzędzia nie potrzebują sekretów ani uprawnień administratora.

To aplikacja do lokalnego pokazu. Serwer nasłuchuje wyłącznie na `127.0.0.1`.
Panel sceniczny jest dostępny dla osoby korzystającej z tego komputera. Nie wystawiaj
tej wersji przez tunel ani do internetu. Ranking przyjmuje wynik obliczony w
przeglądarce — sprawdza format, zakres, sesję i czas, ale nie jest systemem anti-cheat.

Paczka zawiera CI, ale **nie wdraża zasobów Azure**. Wersja publiczna wymaga osobnego
przygotowania: HTTPS, dostępu administratora do panelu, trwałego magazynu wyników,
konfiguracji hosta i wdrożenia. Lokalny przełącznik sceny nie zastępuje tego etapu.

## Testy i zakres sprawdzenia

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe run.py --check
```

Opcjonalnie dla developera, gdy Node.js jest dostępny (do gry nie jest potrzebny):

```text
node --test tests/rules.test.mjs
```

Sprawdzono instalację w nowym venv na Linux/Python 3.12, 10 testów backendu,
9 testów reguł JavaScript, składnię modułów i integralność lokalnych zasobów.
Nie przeprowadzono tutaj wizualnej próby przeglądarki ani fizycznego testu kamery
na Windowsie. Przed wystąpieniem wykonaj własną próbę na docelowym laptopie.

## Rozwiązywanie problemów

**Kamera zablokowana:** zezwól na nią w ustawieniach strony przy pasku adresu.
Używaj `http://127.0.0.1:8001` lub `http://localhost:8001`, nie pliku HTML z dysku.
Na Windowsie sprawdź Ustawienia → Prywatność i zabezpieczenia → Kamera oraz dostęp
aplikacji klasycznych. Zamknij Teams/Zoom, jeśli używają urządzenia.

**Model się nie ładuje:** uruchom `run.py --check` jak wyżej. Przy brakującym lub
uszkodzonym pliku rozpakuj ponownie cały ZIP. Użyj aktualnego Edge albo Chrome.
Model działa w osobnym wątku z OffscreenCanvas; przeglądarki bez niego otrzymają
czytelny komunikat. Nie usuwaj folderu `vendor`.

**Gesty są niestabilne:** pokaż jedną dłoń, popraw oświetlenie, zmniejsz odległość,
zamknij aplikacje obciążające procesor. Nie trzeba instalować sterowników AI ani
mieć dedykowanej karty graficznej; rzeczywistą płynność sprawdź na swoim sprzęcie.

**Ranking pokazuje 503:** sprawdź F8 — kontrolowana usterka mogła pozostać włączona
po próbie. Wyłącz ją i kliknij „Ponów zapis”. Wynik do ponowienia pozostaje w pamięci
tej karty; nie odświeżaj jej i nie rozpoczynaj nowej rundy przed zapisaniem.

**Zajęty port:** z terminala uruchom `START.cmd --port 8002`, a następnie otwórz
`http://127.0.0.1:8002`. Prezentacja z poprzedniej paczki używa portu 8000.

**Nie chcę otwierać przeglądarki automatycznie:** `START.cmd --no-browser`.

**Brak Pythona/pip:** sprawdź `py -3 --version` i `py -3 -m ensurepip --upgrade`.
Przy problemach z instalacją wybierz standardowy CPython 64-bit, z pip i venv.
Instalator nie kompiluje pakietów ze źródeł i nie zmienia ustawień systemowych.

**GitHub:** aby użyć workflow, umieść zawartość folderu `neon-pilot` w katalogu
głównym własnego repozytorium. Nie dodawaj `.venv` ani `data`. Model WASM jest
potrzebny do kontroli pakietu i do działania offline.
