# Biletomat – wersje A i B (interfejs nr 4)

Dwie niezależne aplikacje React (Vite + Tailwind), każda w swoim katalogu z własnym `package.json` i `Dockerfile`:

| Katalog | Opis | Port |
|---|---|---|
| `wersja-a/` | Wierna replika oryginalnego biletomatu (1024 × 768, 15", poziomo) | 8067 |
| `wersja-b/` | Wersja poprawiona wg 7 zasad projektowania uniwersalnego + ustawienia dostępności | 8068 |
| `tools/` | Skrypt liczący metryki z plików zdarzeń | |

## Uruchomienie (Docker)

    docker compose up --build -d
    # wersja A: http://localhost:8067     wersja B: http://localhost:8068
    docker compose down

Pojedyncza wersja: `docker compose up --build -d biletomat-b`, albo w katalogu wersji
`docker build -t biletomat-b . && docker run --rm -p 8068:80 biletomat-b`.
Lokalnie bez Dockera: `cd wersja-b && npm ci && npm run dev` (http://localhost:5173).

## Przebieg sesji z eyetrackerem

1. Otwórz `http://localhost:8068/?uczestnik=P01&kolejnosc=BA` (parametry opcjonalne, można je wpisać w panelu).
2. Panel prowadzącego pokazuje nazwę pliku, skalowanie systemu (musi być 100%) i rozmiar ekranu.
   „Rozpocznij sesję” włącza pełny ekran i zapisuje wiersz `sesja`; panel znika.
3. Skróty (Ctrl+Shift+…): **1 / 2 / 3** start scenariusza S1 / S2 / S3 (ekran wraca na startowy; w B ustawienia dostępności
   i język wracają do domyślnych), **E** przerwanie scenariusza (sukces = 0), **L** pobranie pliku CSV,
   **R** powrót na ekran startowy bez kasowania logu.
4. Po sesji pobierz plik (Ctrl+Shift+L): `PUN_zdarzenia_I04_P01_B.csv`. Zdarzenia są też zapisywane na bieżąco w pamięci
   przeglądarki, więc odświeżenie strony ich nie kasuje (panel startowy pozwala pobrać lub wyczyścić zapis).
5. Druga wersja z kolejności BA: `http://localhost:8067/?uczestnik=P01&kolejnosc=BA`.

Wymagane: pełny ekran i skalowanie systemu 100% (współrzędne w pikselach od lewego górnego rogu ekranu).

## Format logu (PUN_zdarzenia.csv)

20 kolumn, średnik, UTF-8 z BOM, jeden wiersz = jedno zdarzenie. Typy: `sesja`, `scenariusz_start`, `ekran`, `aoi`,
`aoi_znika`, `dotkniecie`, `blad`, `scenariusz_koniec`. Logowane są dotknięcia tylko w trakcie scenariusza
(także poza panelem: `poza_ekranem`; tło panelu: `tlo`; trafienie 0).

Koniec scenariusza i sukces (`SCENARIO_GOALS`, `SCENARIO_END_SCREEN` na górze pliku `Biletomat*.tsx`):

| Scenariusz | Koniec (wejście na ekran) | Wersja A: sukces, gdy | Wersja B: sukces, gdy |
|---|---|---|---|
| S1 | wydruk biletów | 1 × 40 min normalny, karta | 1 × 90 min normalny, karta |
| S2 | wybór metody płatności | 2 × 15 min ulgowe | 3 × 15 min ulgowe |
| S3 | konto z opcją „Doładuj” | użyto cofania znaku (poprawka) i dotarto do konta | to samo |

W S3 sukces nie zależy od konkretnego numeru: liczy się poprawienie błędnego znaku (co najmniej jedno użycie przycisku cofania znaku) i dojście do konta. Jeśli chcecie dodatkowo wymagać konkretnego numeru z karty badania, wpiszcie go w `SCENARIO_GOALS.S3.id`; przy braku poprawki w `opis` zapisuje się `poprawki=0`. AOI: `AOI_wstecz` = Wstecz; `AOI_cel` zależy od scenariusza (S1 „Płacę kartą…”,
S2 plus przy 15-min ulgowym, S3 przycisk cofania znaku); `AOI_dostepnosc` (tylko B) = przycisk „Dostępność”
i przycisk „Potrzebuję więcej czasu”. `AOI_blad` występuje tylko w wersji B (komunikat o nieprawidłowym numerze na ekranie bilety okresowe); w wersji A nie ma komunikatów błędu.

## Wersja B: zmiany względem A

1. Cele dotykowe ≥ 44 × 44 px (główne 64–96 px); Wstecz i Anuluj duże, z podpisem, na dolnym pasku.
2. Domyślny kontrast ≥ 7:1; nieaktywne elementy z przerywaną ramką.
3. Ostrzeżenie przed końcem limitu czasu i przycisk „Potrzebuję więcej czasu” (`IDLE_TIMEOUT_S` = 90 s, ostrzeżenie 30 s
   przed końcem; do testów `?idle=10`).
4. Osobny ekran podsumowania zamówienia (Wstecz, Anuluj, Zapłać).
5. Wskaźnik postępu „Krok X z N”, stały Wstecz; identyfikator konta w pełni; nieprawidłowy numer (np. 000000000) daje komunikat błędu zamiast ukrytego błędu „4.8e+10” z wersji A (zasada 5). Założenie: numer zaczynający się od 0 jest nieprawidłowy.
6. Prosty język i ikony z podpisami.
7. Ustawienia dostępności (przycisk „Dostępność” na każdym ekranie): motyw kontrastu (standardowy, biały na czarnym,
   żółty na czarnym, czarny na żółtym; wszystkie ≥ 7:1, tło ze wzorem wyłączane), rozmiar tekstu (100% / 120% / 140%),
   języki PL, EN, UA, DE, ES (`TRANSLATIONS` w `BiletomatWersjaB.tsx`; dodanie języka to nowy wpis + flaga),
   widoczny fokus klawiatury.

## Metryki z pliku zdarzeń

    python3 tools/zdarzenia_do_metryk.py PUN_zdarzenia_I04_P01_B.csv > metryki.csv

Liczy sukces, czas_ms, dotkniecia, dotkniecia_obok, powroty (osobno dla każdej próby scenariusza) oraz moment pojawienia się
AOI_cel (czas_epoch_ms), od którego w iMotions liczy się ttff_ms. Sprawdzono na PUN_zdarzenia_przyklad.csv.

## Grafiki i ustawienia

Obiekt `ASSETS` na górze `Biletomat*.tsx` wskazuje pliki z `public/assets/` (`tlo.jpg`, `naglowek.png`, `start.png`; jeśli plik
się nie wczyta, aplikacja wraca do neutralnych grafik z kodu). Stałe: `SCALE`, `AUTO_PRINT_MS`, `AUTO_END_MS`,
`IDLE_TIMEOUT_S`, `MIN_ID_LENGTH`, `MAX_ID_LENGTH`.

## Nieprawidłowy numer (bilety okresowe)
- Wersja A odtwarza oryginał: poprawny numer jest pokazany normalnie, dla nieprawidłowego (np. 000000000) wyświetla się „4.8e+10”, bez komunikatu.
- Wersja B: komunikat błędu (`blad` / `NUMER_NIEPRAWIDLOWY`, AOI_blad `komunikat_bledu`), znika po następnym klawiszu.
- Reguła nieprawidłowości: `isValidId` (A) i `submitId` (B), obecnie numer zaczynający się od 0. Do potwierdzenia na urządzeniu.
