/* Moduł rejestrowania zdarzeń zgodny ze specyfikacją PUN_zdarzenia.csv
   (20 kolumn, 8 typów zdarzeń, jeden plik na uczestnika i wersję).
   Format: separator ";", UTF-8 z BOM, liczby całkowite, wiersze w kolejności czasu. */

export const COLUMNS = [
  'interfejs', 'uczestnik', 'wersja', 'kolejnosc', 'scenariusz',
  'czas_lokalny', 'czas_epoch_ms', 'czas_ms',
  'zdarzenie', 'ekran', 'element', 'etykieta',
  'x', 'y', 'szer', 'wys', 'trafienie', 'aoi', 'sukces', 'opis',
];

const pad = (n, l = 2) => String(n).padStart(l, '0');

export const formatLocal = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

const cell = (v) => {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'number' ? String(Math.round(v)) : String(v);
  s = s.replace(/[\r\n]+/g, ' ');
  return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function createLogger({ interfejs, wersja }) {
  let uczestnik = '';
  let kolejnosc = '';
  let rows = [];
  let scenario = '';
  let t0 = 0;
  let lastEpoch = 0;

  const storageKey = () => `pun_zdarzenia_${interfejs}_${uczestnik}_${wersja}`;
  const persist = () => {
    try { localStorage.setItem(storageKey(), JSON.stringify(rows)); } catch (e) { /* brak miejsca lub tryb prywatny */ }
  };
  const load = () => {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); } catch (e) { return []; }
  };

  // zegar niemalejący, aby wiersze zawsze były w kolejności czasu
  const nowMs = () => { lastEpoch = Math.max(Date.now(), lastEpoch); return lastEpoch; };

  const emit = (zdarzenie, fields = {}) => {
    if (!uczestnik) return;
    const epoch = nowMs();
    const row = {
      interfejs, uczestnik, wersja, kolejnosc, scenariusz: scenario,
      czas_lokalny: formatLocal(new Date(epoch)),
      czas_epoch_ms: epoch,
      czas_ms: scenario ? epoch - t0 : '',
      zdarzenie,
      ...fields,
    };
    rows.push(row);
    persist();
    return row;
  };

  return {
    /** Odczyt zapisanych zdarzeń danej sesji (bez rozpoczynania sesji). */
    peek: (p) => {
      const save = uczestnik; uczestnik = p;
      const r = load(); uczestnik = save; return r.length;
    },
    /** Wczytanie zapisanych zdarzeń bez dopisywania wiersza „sesja" (pobranie lub kasowanie). */
    open: (p, k) => { uczestnik = p; kolejnosc = k; scenario = ''; rows = load(); },
    /** Uruchomienie aplikacji: wiersz „sesja". Dopisuje do istniejącego pliku sesji. */
    begin: ({ uczestnik: p, kolejnosc: k, opis }) => {
      uczestnik = p; kolejnosc = k; scenario = '';
      rows = load();
      return emit('sesja', { opis });
    },
    emit,
    startScenario: (s) => { scenario = s; t0 = nowMs(); return emit('scenariusz_start'); },
    endScenario: ({ ekran, sukces, opis }) => {
      if (!scenario) return;
      const row = emit('scenariusz_koniec', { ekran, sukces: sukces ? 1 : 0, opis });
      scenario = '';
      return row;
    },
    active: () => !!scenario,
    scenario: () => scenario,
    ready: () => !!uczestnik,
    rows: () => rows,
    clear: () => { rows = []; persist(); },
    fileName: () => `PUN_zdarzenia_I${pad(interfejs)}_${uczestnik}_${wersja}.csv`,
    csv: () =>
      '﻿' + COLUMNS.join(';') + '\r\n' +
      rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(';')).join('\r\n') + '\r\n',
    download() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([this.csv()], { type: 'text/csv;charset=utf-8' }));
      a.download = this.fileName();
      document.body.appendChild(a); a.click(); a.remove();
    },
  };
}
