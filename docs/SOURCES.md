# Dokumentacja i pochodzenie zasobów

Weryfikacja: 11.10.2026.

- MediaPipe Gesture Recognizer, API Web:
  https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
  Używamy rozpoznawania jednej dłoni w wątku roboczym, lokalnie w przeglądarce.
- Oficjalne przykłady MediaPipe:
  https://github.com/google-ai-edge/mediapipe-samples-web
- Pakiet runtime: `@mediapipe/tasks-vision` 0.10.32, pobrany z oficjalnego rejestru npm.
  Archiwum zweryfikowano względem jego SHA-512 (npm integrity). Skopiowano wyłącznie
  bundle ESM i pliki WASM. Hash każdego dołączonego pliku jest w vendor/manifest.json.
- Model Gesture Recognizer, float16, wersja 1:
  https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- Kod MediaPipe: https://github.com/google-ai-edge/mediapipe
  Licencja Apache 2.0 jest w `neon_pilot/static/vendor/LICENSE-mediapipe.txt`.
- Kamera w przeglądarce: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Flask + Waitress na Windowsie: https://flask.palletsprojects.com/en/stable/deploying/waitress/

Neon Pilot używa gotowego modelu rozpoznawania gestów. Nie trenuje modelu,
nie wywołuje zdalnego AI i nie zawiera integracji z API Copilota. Prompty do
pracy w osobnym VS Code znajdują się w DEMO.md. Grafika gry powstaje w Canvas.
