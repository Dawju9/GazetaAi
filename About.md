# Kurier Świata — About

Interaktywne, elektroniczne wydanie gazety publikowane automatycznie na **GitHub Pages** z wykorzystaniem **Node.js** i **GitHub Actions**.

## Czym jest projekt

Kurier Świata to cyfrowa gazeta w konwencji dziennika informacyjnego (w stylu „Gazety Wyborczej” czy „Newsweeka”). Każde wydanie składa się z kilku stron: czołówki, działów tematycznych oraz indeksu wszystkich wiadomości. Wygląd nawiązuje do druku — czołowe nagłówki, rysunki, szpalty, daty i podpisy źródeł.

Gazeta **nie wymyśla wiadomości**. Wszystkie tytuły, daty, nazwy wydawców i odnośniki pobierane są z publicznych kanałów RSS Google News w języku polskim i filtrowane wyłącznie do ostatnich **7 dni**. Kliknięcie w dowolną informację prowadzi do oryginalnego artykułu u wydawcy.

## Najważniejsze funkcje

- **Przewracanie papieru** — stronę zmienia się, chwytając ją kursorem lub palcem i przeciągając w bok (obsługa myszy, dotyku i klawiatury `←` / `→`). Efekt zawijania papieru uzyskano z CSS 3D i Web Animations API.
- **Strony i działy** — czołówka, Świat, Kraj, Biznes, Technologia, Sport, Kultura, Nauka, Zdrowie oraz indeks całego wydania.
- **Wyszukiwarka** — szuka po tytułach, źródłach i powiązanych nagłówkach z bieżącego wydania (`/` otwiera wyszukiwarkę). Dodatkowy odnośnik pozwala przeszukać **bieżące wiadomości w internecie** przez Google News.
- **Powrót na czołówkę** — kliknięcie loga „KŚ” w lewym górnym rogu wraca na pierwszą stronę i przewija ją na górę.
- **Świeże wydanie** — przycisk w górnym pasku otwiera akcję GitHub, w której można ręcznie uruchomić pobranie nowych informacji. Strona sama sprawdza też, czy pojawiło się nowsze wydanie.
- **Automatyczna aktualizacja** — każdy `git push` do repozytorium uruchamia akcję, która pobiera wiadomości, buduje stronę i publikuje ją na GitHub Pages. Dodatkowo wydanie odświeża się harmonogramowo co 6 godzin.
- **Wiarygodność** — każda informacja ma datę, godzinę, nazwę wydawcy oraz bezpośredni link do materiału źródłowego. Nagłówki powiązane również pochodzą z RSS.

## Jak to działa

1. `scripts/fetch-news.mjs` (Node.js, bez zewnętrznych zależności) pobiera osiem kanałów Google News RSS.
2. Wiadomości starsze niż 7 dni są odrzucane; pozostałe są deduplikowane i rankowane według świeżości oraz liczby powiązań.
3. Dla wszystkich artykułów zajmujących miejsce na zdjęcie (czołówka i pierwsze pozycje działów) adres Google News jest rozwiązywany do prawdziwego URL-u wydawcy. Ze strony wydawcy pobierane są zdjęcia `og:image`, `twitter:image`, dane JSON-LD lub pierwszy pasujący obrazek; gdy zawiedzie wszystko, używana jest miniatura favicon domeny. Pliki zapisywane są lokalnie w `dist/assets/img/`.
4. Skrypt generuje `dist/data/news.json` oraz strony WWW (`dist/index.html`, `styles.css`, `app.js`).
5. Workflow `.github/workflows/deploy.yml` wysyła katalog `dist` jako artefakt i wdraża go przez oficjalne akcje Pages.
6. Kopia ostatniego udanego wydania (`data/news.json`, `data/img/`) służy jako zabezpieczenie, gdyby pobieranie wiadomości chwilowo nie zadziałało.

## Uruchomienie lokalne

```bash
npm run build   # pobiera prawdziwe wiadomości i buduje katalog dist/
npm run dev     # serwer statyczny pod adresem http://localhost:4173
npm run check   # sprawdzenie składni plików JS
```

Wymagany jest Node.js w wersji 20 lub nowszej. Nie trzeba instalować żadnych pakietów ani kluczy API.

## Konfiguracja GitHub Pages

W ustawieniach repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Nadaj workflow uprawnienia `pages: write` i `id-token: write` (są już w pliku YAML). Po pierwszym pushu strona będzie dostępna pod adresem `https://<użytkownik>.github.io/<repo>/`.

## Ograniczenia

Google News udostępnia nagłówki i linki, nie pełne teksty artykułów — dlatego gazeta publikuje informacje w formie czołówek z odnośnikami do wydawców, a nie streszczenia własne. Rozwiązywanie adresów i pobieranie zdjęć jest opcjonalne: jeśli wydawca blokuje bots, artykuł pozostaje z linkiem Google News i grafiką zastępczą. Prawa autorskie do fotografii i treści należą do odpowiednich wydawców.
