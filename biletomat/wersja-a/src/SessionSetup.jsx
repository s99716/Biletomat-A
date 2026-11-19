import React, { useState } from 'react';

/* Panel prowadzącego, widoczny tylko przed rozpoczęciem sesji (poza ekranem urządzenia).
   Parametry w adresie: ?uczestnik=P01&kolejnosc=AB */
export default function SessionSetup({ logger, interfejs, wersja, onStart }) {
  const params = new URLSearchParams(window.location.search);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('pun_ostatnia_sesja') || '{}'); } catch (e) { return {}; } })();
  const [uczestnik, setUczestnik] = useState((params.get('uczestnik') || saved.uczestnik || 'P01').toUpperCase());
  const [kolejnosc, setKolejnosc] = useState((params.get('kolejnosc') || saved.kolejnosc || 'AB').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);

  const okId = /^P\d{2}$/.test(uczestnik);
  const okOrder = kolejnosc === 'AB' || kolejnosc === 'BA';
  const dpr = Math.round(window.devicePixelRatio * 100);
  const small = window.screen.width < 1024 || window.screen.height < 768;
  const stored = okId ? logger.peek(uczestnik) : 0;

  const start = () => {
    if (!okId || !okOrder) return;
    setBusy(true);
    try { localStorage.setItem('pun_ostatnia_sesja', JSON.stringify({ uczestnik, kolejnosc })); } catch (e) { /* ignoruj */ }
    try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignoruj */ }
    // chwila na wejście w tryb pełnoekranowy, żeby wiersz „sesja" zapisał końcowe wymiary okna
    setTimeout(() => onStart({ uczestnik, kolejnosc }), 700);
  };

  const box = { background: '#fff', color: '#111', width: 520, maxWidth: '92vw', padding: 24, borderRadius: 8, fontFamily: 'system-ui, sans-serif', fontSize: 14 };
  const inp = { border: '1px solid #999', borderRadius: 4, padding: '6px 8px', fontSize: 16, width: 120 };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#2b2b2b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={box}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Rejestrowanie sesji (panel prowadzącego)</h2>
        <div style={{ color: '#555', marginBottom: 16 }}>Interfejs nr {interfejs}, wersja {wersja}. Ten panel zniknie po starcie.</div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
          <label>Uczestnik (P01–P99)<br /><input style={inp} value={uczestnik} onChange={(e) => setUczestnik(e.target.value.toUpperCase())} /></label>
          <label>Kolejność wersji<br />
            <select style={inp} value={kolejnosc} onChange={(e) => setKolejnosc(e.target.value)}>
              <option value="AB">AB</option><option value="BA">BA</option>
            </select>
          </label>
        </div>

        <div style={{ background: '#f4f4f4', padding: 10, borderRadius: 4, marginBottom: 14, lineHeight: 1.5 }}>
          Plik: <b>PUN_zdarzenia_I{String(interfejs).padStart(2, '0')}_{uczestnik}_{wersja}.csv</b><br />
          Skalowanie systemu: <b style={{ color: dpr === 100 ? '#0a7a2f' : '#b00020' }}>{dpr}%</b> {dpr !== 100 && '(wymagane 100%, inaczej współrzędne będą błędne)'}<br />
          Ekran: <b style={{ color: small ? '#b00020' : 'inherit' }}>{window.screen.width}×{window.screen.height}</b> {small && '(mniejszy niż panel 1024×768)'}<br />
          {stored > 0 && <>W pamięci przeglądarki jest już <b>{stored}</b> zdarzeń tej sesji, nowe zostaną dopisane. </>}
        </div>

        <div style={{ lineHeight: 1.6, marginBottom: 16 }}>
          <b>Skróty podczas badania (Ctrl+Shift+…):</b><br />
          <b>1 / 2 / 3</b> start scenariusza S1 / S2 / S3 (ekran wraca na startowy)<br />
          <b>E</b> przerwanie scenariusza (sukces = 0)<br />
          <b>L</b> pobranie pliku CSV · <b>R</b> powrót na ekran startowy (bez kasowania logu)
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={start} disabled={busy || !okId || !okOrder}
            style={{ padding: '10px 18px', fontSize: 16, fontWeight: 700, background: '#1f3d8a', color: '#fff', border: 0, borderRadius: 4, opacity: busy || !okId || !okOrder ? 0.5 : 1 }}>
            {busy ? 'Uruchamianie…' : 'Rozpocznij sesję (pełny ekran)'}
          </button>
          {stored > 0 && (
            <>
              <button onClick={() => { logger.open(uczestnik, kolejnosc); logger.download(); }}
                style={{ padding: '10px 14px', border: '1px solid #888', borderRadius: 4, background: '#fff' }}>Pobierz zapisany log</button>
              <button onClick={() => { if (window.confirm('Skasować zapisany log tej sesji?')) { logger.open(uczestnik, kolejnosc); logger.clear(); bump((n) => n + 1); } }}
                style={{ padding: '10px 14px', border: '1px solid #b00020', color: '#b00020', borderRadius: 4, background: '#fff' }}>Wyczyść log</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
