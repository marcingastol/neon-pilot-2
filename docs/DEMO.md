# Scenariusz sceniczny — Neon Pilot

## Wersja do szybkiego pokazu (bez pisania kodu)

1. Uruchom grę, kamerę i pełny ekran. Zagraj przez kilkanaście sekund.
2. Zaproś ochotnika. Niech porusza zamkniętą dłonią i spróbuje zebrać energię.
3. Otwórz dłoń — pojawia się tarcza. Pokaż jej 3 sekundy działania.
4. Trzymaj dłoń otwartą dalej: tarcza wygasa. Po upływie 10 sekund zamknij
   i otwórz dłoń ponownie. To widoczny dowód, że nie ma nieśmiertelności.
5. Zapisz wynik pod pseudonimem. Ranking nie zawiera fikcyjnych uczestników.

F8 pozwala przełączyć gotową tarczę i przećwiczyć prezentację „przed / po”.
Powiedz, że przełączasz gotową funkcję. To nie jest live coding ani deploy.

## Rzeczywista zmiana kodu z Copilotem

Gotowej gry używaj jako punktu powrotu. Generator przygotuje oddzielną kopię,
w której funkcja aktywacji tarczy jest celowo niedokończona.

W PowerShell, w folderze gotowej gry:

```powershell
py -3 tools/prepare_live_demo.py ..\neon-pilot-live
```

Skrypt wymaga nowego folderu. Nie nadpisuje istniejących plików, nie modyfikuje
gotowej gry i nie kopiuje rankingu ani venv. W nowym folderze uruchom INSTALUJ.cmd,
a potem START.cmd. Nie uruchamiaj obu serwerów na tym samym porcie; alternatywą
jest `START.cmd --port 8002` dla kopii ćwiczeniowej.

Ta kopia działa bez tarczy. Testy akceptacji nowej funkcji są już dołączone i mają
być czerwone. To jawnie przygotowane ćwiczenie, nie losowy błąd Copilota.
Otwórz kopię ćwiczeniową w VS Code i użyj tego polecenia:

> W tej grze uzupełnij metodę Shield.input w neon_pilot/static/rules.mjs.
> Tarcza ma chronić przez dokładnie 3 sekundy. Następna aktywacja najwcześniej
> po 10 sekundach od poprzedniej i tylko po zwolnieniu oraz ponownym wykonaniu
> gestu/naciśnięcia. Przytrzymanie nie może przedłużać ochrony ani ponownie jej
> uruchamiać. Zachowaj obsługę enabled=false. Nie zmieniaj modelu kamery, API,
> renderera ani wymagań testów. Wyjaśnij poprawkę i uruchom dostępne testy.

Sprawdź diff i wynik testów reguł. W tym ćwiczeniu kod funkcji jest zmianą;
włączenie flagi w F8 tylko udostępnia ją w następnej rundzie. Po zmianie modułu
odśwież grę. Flaga tarczy w kopii startuje wyłączona; włącz ją w F8 i rozpocznij
nową rundę. Otwarta dłoń ma teraz uruchamiać realną, właśnie zaimplementowaną tarczę.

Testy reguł wymagają Node.js na komputerze developera albo wykonania przez
dołączony GitHub Actions. Node.js nie jest potrzebny do uruchomienia samej gry.
Uruchomienie CI wymaga uprzedniego umieszczenia projektu we własnym repozytorium.
Nie przypisuj wyników starego przebiegu nowej zmianie.

## Kontrolowana awaria rankingu

1. Zagraj rundę. Pozostaw ekran wyniku otwarty.
2. Naciśnij F8, włącz „Kontrolowana usterka rankingu” i zapisz ustawienia.
3. Zamknij panel. Spróbuj zapisać wynik. Serwer rzeczywiście zwróci 503,
   a interfejs zachowa wynik do ponowienia.
4. Otwórz F8 i „Kopiuj log dla Copilota”. Przekaż go do tego samego asystenta:

> Po zakończeniu rundy wynik nie zapisuje się w rankingu. Oto log aplikacji
> i kod endpointu /api/scores. Oddziel dowody od hipotez. Wyjaśnij problem osobie
> nietechnicznej i wskaż najmniejszy sposób przywrócenia działania. Nie usuwaj
> bazy i nie zmieniaj walidacji wyniku. Podaj, jak sprawdzić naprawę.

5. Potwierdź w konfiguracji `ranking_fault=true`. Wyłącz kontrolowaną usterkę
   w panelu, zapisz, wróć do wyniku i kliknij „Ponów zapis”.
6. Pokaż wpis w rankingu i `SCORE_SAVED` w logu. Ponowienie nie tworzy duplikatu.

Jawnie nazwij tę awarię kontrolowanym ćwiczeniem. To prawdziwy błąd HTTP wywołany
przełącznikiem, nie dowód na samodzielną naprawę przez AI. W tym wariancie naprawą
jest przywrócenie konfiguracji. Nie trzeba tworzyć sztucznej poprawki kodu.

## Przygotowanie do sceny

- Przećwicz kamerę na docelowym laptopie, w świetle zbliżonym do sali.
- Ustaw duży ekran jako rozszerzony pulpit. Sprawdź, co widzi publiczność.
- Przygotuj okna gry, VS Code i ukończone przebiegi CI. Wyłącz powiadomienia.
- Przetestuj klawiaturę jako zapasowe sterowanie i nagraj własną próbę.
- Dla live coding ogranicz zmianę do metody Shield.input. Nie buduj gry od zera.
- Jeśli odpowiedź AI lub CI trwa zbyt długo, pokaż przygotowany wynik i nazwij
  go wynikiem z próby. Nie czekaj w ciszy na ekranie terminala.

Ta paczka realizuje lokalną grę, live coding, sprawdzanie i ćwiczenie diagnozy.
Etap publikacji do Azure wymaga osobnego wdrożenia. Nie nazywaj odświeżenia
localhost ani przełączenia flagi publikacją do chmury.
