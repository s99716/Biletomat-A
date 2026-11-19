import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Wifi, Smile, Loader2 } from 'lucide-react';
import { createLogger } from './eventLogger.js';
import SessionSetup from './SessionSetup.jsx';

const SCALE = 1;
const AUTO_PRINT_MS = 3000;
const AUTO_END_MS = 3000;
const IDLE_TIMEOUT_S = null;
const MIN_ID_LENGTH = 9;
const MAX_ID_LENGTH = 12;

/* ---------- REJESTROWANIE ZDARZEŃ (PUN_zdarzenia) ---------- */
const INTERFACE_NO = 4;           // numer interfejsu z Tabeli 1 harmonogramu
const VERSION = 'A';
const logger = createLogger({ interfejs: INTERFACE_NO, wersja: VERSION });

/* Cele scenariuszy dla wersji A (Tabela 7). Zmień tutaj, jeśli scenariusz się zmieni. */
const SCENARIO_GOALS = {
  S1: { cart: { normal_40: 1 }, pay: 'card' },   // 1 bilet 40-min normalny, karta; koniec: ekran wydruku
  S2: { cart: { discount_15: 2 } },              // 2 bilety 15-min ulgowe; koniec: ekran wyboru płatności
  S3: { id: null, minCorrections: 1 },   // sukces: użyto cofania znaku (poprawka) i dotarto do konta; ustaw id, aby dodatkowo wymagać konkretnego numeru
};
const SCENARIO_END_SCREEN = { S1: 'DRUK', S2: 'PLATNOSC_WYB', S3: 'OKRESOWE_KONTO' };

const SCREEN_NAMES = {
  START: 'start', MENU: 'menu', CZASOWE: 'czasowe', CZASOWE_NORM: 'czasowe_normalne',
  CZASOWE_ULG: 'czasowe_ulgowe', PLATNOSC_WYB: 'wybor_platnosci', PLATNOSC: 'platnosc',
  DRUK: 'druk', KONIEC: 'koniec', OKRESOWE: 'okresowe', OKRESOWE_KONTO: 'okresowe_konto',
};
/* Wspólna lista AOI. AOI_cel zależy od scenariusza (Tabela 7). */
const AOI_DEFS = [
  { aoi: 'AOI_wstecz', id: 'btn_back' },
  { aoi: 'AOI_cel', id: 'pay_card', screen: 'PLATNOSC_WYB', scenario: 'S1' },
  { aoi: 'AOI_cel', id: 'plus_discount_15', screen: 'CZASOWE_ULG', scenario: 'S2' },
  { aoi: 'AOI_cel', id: 'key_back', screen: 'OKRESOWE', scenario: 'S3' },
];
const ELEMENT_NAMES = { btn_back: 'wstecz', btn_cancel: 'anuluj', btn_next: 'dalej', btn_end: 'koniec', key_back: 'klawisz_cofnij_znak', key_ok: 'ok' };
const elementName = (el) => el.dataset.log || ELEMENT_NAMES[el.dataset.id] ||
  (/^key_\d$/.test(el.dataset.id) ? 'klawisz_' + el.dataset.id.slice(4) : el.dataset.id);
const labelOf = (el) => (el.getAttribute('aria-label') || el.dataset.label || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), szer: Math.round(r.width), wys: Math.round(r.height) }; };
const sameCart = (cart, goal) => {
  const a = Object.keys(cart), b = Object.keys(goal);
  return a.length === b.length && b.every((k) => cart[k] && cart[k].qty === goal[k]);
};

const ASSETS = {
  panelImage: null,
  background: '/assets/tlo.jpg',
  headerLogos: '/assets/naglowek.png',
  startLogo: '/assets/start.png',
  partnersBand: null,
};


const TRANSLATIONS = {
  PL: {
    start: "Dotknij ekranu, aby rozpocząć transakcję",
    menuTime: "BILETY CZASOWE", menuSeason: "BILETY OKRESOWE", menuOther: "KUP INNĄ USŁUGĘ",
    typeNormal: "NORMALNY", typeDiscount: "ULGOWY", normalWord: "Normalny", discountWord: "Ulgowy",
    btnBack: "Cofnij", btnCancel: "Anuluj", btnEnd: "Koniec", btnNext: "Dalej",
    seasonDesc: "Wprowadź nr telefonu dla aplikacji\nlub numer karty i potwierdź [OK]",
    tileCard: "Włóż kartę do czytnika", tileQr: "Zeskanuj kod QR\nz aplikacji",
    seasonId: "IDENTYFIKATOR KONTA", wallet: "Elektroniczna portmonetka",
    seasonFunds: "Środki na koncie", seasonTopup: "Doładuj", seasonBuy: "Kup bilet",
    seasonFooter: "Bilety zakupione w systemie biletowym",
    payCard: "Płacę kartą płatniczą lub BLIK", payCash: "Płacę gotówką",
    payTotal: "Do zapłaty", payInst: "Dla płatności zbliż kartę\ndo terminala płatniczego",
    simHint: "Dotknij, aby zasymulować zbliżenie karty",
    printWait: "Wydruk biletów, proszę czekać...",
    doneMsg: "Transakcja zakończona.", doneRec: "Wydrukuj potwierdzenie płatności",
    zone: "STREFA 1+2", total: "Razem:",
    t15: "Bilet 15-minutowy", t40: "Bilet 40-minutowy", t90: "Bilet 90-minutowy",
    t6h: "Bilet 6 - godzinny", t24h: "Bilet 24-godzinny",
  },
  EN: {
    start: "Touch the screen to start",
    menuTime: "TIME TICKETS", menuSeason: "SEASON TICKETS", menuOther: "BUY OTHER SERVICE",
    typeNormal: "STANDARD", typeDiscount: "DISCOUNTED", normalWord: "Standard", discountWord: "Discounted",
    btnBack: "Back", btnCancel: "Cancel", btnEnd: "End", btnNext: "Next",
    seasonDesc: "Enter phone number for the app\nor card number and confirm [OK]",
    tileCard: "Insert the card into the reader", tileQr: "Scan the QR code\nfrom the app",
    seasonId: "ACCOUNT IDENTIFIER", wallet: "Electronic wallet",
    seasonFunds: "Account balance", seasonTopup: "Top up", seasonBuy: "Buy ticket",
    seasonFooter: "Tickets bought in the ticketing system",
    payCard: "Pay with card or BLIK", payCash: "Pay with cash",
    payTotal: "To pay", payInst: "To pay, bring your card\nto the payment terminal",
    simHint: "Touch to simulate tapping the card",
    printWait: "Printing tickets, please wait...",
    doneMsg: "Transaction completed.", doneRec: "Print payment receipt",
    zone: "ZONE 1+2", total: "Total:",
    t15: "15-minute ticket", t40: "40-minute ticket", t90: "90-minute ticket",
    t6h: "6-hour ticket", t24h: "24-hour ticket",
  },
  UA: {
    start: "Торкніться екрана, щоб розпочати",
    menuTime: "ЧАСОВІ КВИТКИ", menuSeason: "ПЕРІОДИЧНІ КВИТКИ", menuOther: "ІНШІ ПОСЛУГИ",
    typeNormal: "ЗВИЧАЙНИЙ", typeDiscount: "ПІЛЬГОВИЙ", normalWord: "Звичайний", discountWord: "Пільговий",
    btnBack: "Назад", btnCancel: "Скасувати", btnEnd: "Кінець", btnNext: "Далі",
    seasonDesc: "Введіть номер телефону для додатку\nабо номер картки і підтвердіть [OK]",
    tileCard: "Вставте картку в зчитувач", tileQr: "Скануйте QR-код\nз додатку",
    seasonId: "ІДЕНТИФІКАТОР РАХУНКУ", wallet: "Електронний гаманець",
    seasonFunds: "Кошти на рахунку", seasonTopup: "Поповнити", seasonBuy: "Купити квиток",
    seasonFooter: "Квитки, придбані в системі",
    payCard: "Оплата карткою або BLIK", payCash: "Оплата готівкою",
    payTotal: "До сплати", payInst: "Для оплати піднесіть картку\nдо платіжного терміналу",
    simHint: "Торкніться, щоб імітувати прикладання картки",
    printWait: "Друк квитків, зачекайте...",
    doneMsg: "Транзакцію завершено.", doneRec: "Роздрукувати підтвердження оплати",
    zone: "ЗОНА 1+2", total: "Разом:",
    t15: "Квиток 15 хв", t40: "Квиток 40 хв", t90: "Квиток 90 хв",
    t6h: "Квиток 6 год", t24h: "Квиток 24 год",
  },
};


const TICKETS = [
  { id: '15', key: 't15', normal: 3.4, discount: 1.7 },
  { id: '40', key: 't40', normal: 4.6, discount: 2.3 },
  { id: '90', key: 't90', normal: 5.2, discount: 2.6 },
  { id: '6h', key: 't6h', normal: 9.0, discount: 4.5 },
  { id: '24h', key: 't24h', normal: 14.2, discount: 7.1 },
];


const C = {
  bg: '#f4f0e1', bar: '#e4e0d1', line: '#c3beaa', btn: '#f8f5ea', btnBorder: '#c4bfac',
  text: '#3a3a3a', textSoft: '#6b6b6b', textFaint: '#9a9a96', disabledBg: '#d3d1c6', disabledText: '#9d9b92',
};

const formatPrice = (p) => p.toFixed(2).replace('.', ',') + ' zł';

const formatDate = (date) => {
  const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const p = (n) => String(n).padStart(2, '0');
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
};


const NeutralMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <rect x="20" y="20" width="60" height="60" fill="#9a9a9a" transform="rotate(45 50 50)" />
    <polygon points="50,20 80,50 50,80 20,50" fill="#666" />
  </svg>
);

const failedAssets = new Set<string>();
const assetOk = (key: keyof typeof ASSETS) => !!ASSETS[key] && !failedAssets.has(key);
const AssetImg = ({ k, fallback, ...rest }: any) => {
  const [, force] = useState(0);
  if (!assetOk(k)) return fallback;
  return <img src={ASSETS[k as keyof typeof ASSETS] as string} alt="" {...rest}
    onError={() => { failedAssets.add(k); force(n => n + 1); }} />;
};

const HeaderLogos = () => (
  <AssetImg k="headerLogos" style={{ height: 40 }} fallback={<div className="flex items-center" style={{ gap: 14 }}>
    <div className="flex items-center" style={{ gap: 6 }}>
      <NeutralMark size={34} />
      <div className="leading-none">
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: '#444' }}>CITY TICKET</div>
        <div style={{ fontSize: 7, letterSpacing: 1, color: '#777', marginTop: 2 }}>KOMUNIKACJA MIEJSKA</div>
      </div>
    </div>
    <div className="flex items-center" style={{ gap: 4 }}>
      <div style={{ width: 30, height: 22, background: '#666', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1 }}>TA</div>
      <div style={{ fontSize: 6, color: '#777', lineHeight: 1.1, width: 52 }}>TRANSIT<br />AUTHORITY</div>
    </div>
    <div style={{ fontSize: 20, fontStyle: 'italic', color: '#555', fontFamily: 'Georgia, serif' }}>my city</div>
  </div>} />
);

const Background = () =>
  assetOk('background') ? (
    <AssetImg k="background" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} fallback={null} />
  ) : (
    <svg className="absolute inset-0" width="1024" height="768" aria-hidden="true">
      <defs>
        <pattern id="tri" width="120" height="104" patternUnits="userSpaceOnUse">
          <polygon points="0,52 60,0 120,52 60,104" fill="#000" opacity="0.025" />
          <polygon points="60,0 120,52 60,104" fill="#000" opacity="0.02" />
        </pattern>
      </defs>
      <rect width="1024" height="768" fill="url(#tri)" />
    </svg>
  );

const PanelIllustration = () =>
  assetOk('panelImage') ? (
    <AssetImg k="panelImage" className="w-full h-full" style={{ objectFit: 'cover' }} fallback={null} />
  ) : (
    <svg viewBox="0 0 240 520" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfd9de" /><stop offset="1" stopColor="#aebcc4" />
        </linearGradient>
      </defs>
      <rect width="240" height="520" fill="url(#sky)" />
      <rect x="0" y="330" width="240" height="190" fill="#9aa7ae" />
      <rect x="150" y="190" width="90" height="140" fill="#b9a99a" opacity="0.7" />
      <path d="M20 520 C20 390 70 340 120 340 C170 340 220 390 220 520 Z" fill="#4c6a8a" />
      <rect x="100" y="290" width="40" height="60" rx="14" fill="#d9a98a" />
      <ellipse cx="120" cy="240" rx="56" ry="68" fill="#e2b496" />
      <path d="M62 240 C58 150 100 130 130 135 C172 138 186 190 178 252 C176 214 160 180 120 178 C88 176 70 200 62 240 Z" fill="#3b2b27" />
      <circle cx="100" cy="246" r="4" fill="#3b2b27" /><circle cx="140" cy="246" r="4" fill="#3b2b27" />
      <path d="M102 276 Q120 292 138 276" stroke="#a5524b" strokeWidth="5" fill="none" strokeLinecap="round" />
      <g transform="rotate(-14 170 400)">
        <rect x="120" y="372" width="96" height="60" rx="7" fill="#f4f4f4" stroke="#b5b5b5" />
        <polygon points="120,372 190,372 120,420" fill="#8a8a8a" />
        <rect x="150" y="402" width="52" height="6" fill="#bdbdbd" /><rect x="150" y="414" width="34" height="6" fill="#d0d0d0" />
      </g>
      <ellipse cx="116" cy="410" rx="22" ry="16" fill="#e2b496" transform="rotate(-20 116 410)" />
    </svg>
  );

const PartnersBand = () => assetOk('partnersBand') ? (
  <AssetImg k="partnersBand" className="absolute" style={{ left: 270, bottom: 14, height: 54 }} fallback={null} />
) : (
  <div className="absolute flex items-center" style={{ left: 270, right: 24, bottom: 14, height: 54, gap: 40, opacity: 0.9 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center" style={{ gap: 8 }}>
        <div style={{ width: 28, height: 40, background: ['#8c97a8', '#a8a8a8', '#8c97a8'][i] }} />
        <div style={{ width: 92, height: 8, background: '#9a9a9a', opacity: 0.55, borderRadius: 2 }} />
      </div>
    ))}
  </div>
);


const CornerButton = ({ id, aoi, icon, label, onClick, disabled }) => (
  <button
    data-id={id} data-aoi={aoi || ''} data-disabled={disabled ? '1' : '0'}
    onClick={disabled ? undefined : onClick}
    className="flex flex-col items-center justify-center"
    style={{
      width: 74, height: 74, borderRadius: 4,
      background: disabled ? C.disabledBg : C.btn, border: `1px solid ${C.btnBorder}`,
      color: disabled ? C.disabledText : C.text, fontSize: 12,
    }}
  >
    {icon}
    <span style={{ marginTop: 2 }}>{label}</span>
  </button>
);

const Flag = ({ id, active, onClick, children }) => (
  <div
    data-id={id} data-label={id.replace('lang_', '')} onClick={onClick}
    style={{ width: 52, height: 36, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: active ? '3px solid #222' : `1px solid ${C.btnBorder}` }}
  >
    {children}
  </div>
);

const Flags = ({ lang, setLang }) => (
  <div className="flex" style={{ gap: 6 }}>
    <Flag id="lang_PL" active={lang === 'PL'} onClick={() => setLang('PL')}>
      <div style={{ height: '50%', background: '#fff' }} /><div style={{ height: '50%', background: '#d4213d' }} />
    </Flag>
    <Flag id="lang_EN" active={lang === 'EN'} onClick={() => setLang('EN')}>
      <svg viewBox="0 0 60 30" width="100%" height="100%">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30"
          stroke="#fff" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30"
          stroke="#C8102E" strokeWidth="2.5" />
        <path d="M30 0 V30 M0 15 H60"
          stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60"
          stroke="#C8102E" strokeWidth="6" />
      </svg>
    </Flag>
    <Flag id="lang_UA" active={lang === 'UA'} onClick={() => setLang('UA')}>
      <div style={{ height: '50%', background: '#3b7bd6' }} /><div style={{ height: '50%', background: '#f3c613' }} />
    </Flag>
  </div>
);

const Header = ({ dateText, showDate = true, children }) => (
  <>
    <div className="absolute left-0 top-0 w-full" style={{ height: 84 }}>
      <div className="absolute" style={{ left: 16, top: 22 }}><HeaderLogos /></div>
      <div className="absolute flex" style={{ right: 12, top: 4, gap: 6 }}>{children}</div>
    </div>
    {showDate && (
      <div className="absolute left-0 w-full" style={{ top: 86, height: 18, background: C.bar, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ position: 'absolute', right: 14, top: 2, fontSize: 11, fontWeight: 700, color: C.text }}>{dateText}</div>
      </div>
    )}
  </>
);

const Panel = ({ children }) => (
  <div className="absolute overflow-hidden" style={{ left: 14, top: 116, width: 240, height: 560, border: `1px solid ${C.line}`, background: '#ddd' }}>
    <PanelIllustration />
    {children}
  </div>
);

const MenuButton = ({ id, aoi, children, onClick, disabled, h = 54, size = 17 }) => (
  <button
    data-id={id} data-aoi={aoi || ''} data-disabled={disabled ? '1' : '0'}
    onClick={disabled ? undefined : onClick}
    style={{
      width: '100%', height: h, marginBottom: 8, borderRadius: 4, fontSize: size, fontWeight: 300, letterSpacing: 0.5,
      textTransform: 'none', background: disabled ? C.disabledBg : C.btn, border: `1px solid ${C.btnBorder}`,
      color: disabled ? C.disabledText : C.textSoft,
    }}
  >
    {children}
  </button>
);


export default function BiletomatWersjaA() {
  const [screen, setScreen] = useState('START');
  const [history, setHistory] = useState([]);
  const [lang, setLang] = useState('PL');
  const [cart, setCart] = useState({});
  const [phone, setPhone] = useState('');
  const [now, setNow] = useState(new Date());
  const t = TRANSLATIONS[lang];


  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const rootRef = useRef(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const stateRef = useRef({});
  stateRef.current = { cart, phone };
  const paidWith = useRef('');
  const corrections = useRef(0);   // liczba użyć cofania znaku w bieżącym scenariuszu (poprawka błędnego znaku w S3)
  const aoiRef = useRef(new Map());
  const lastScreenKey = useRef('');
  const screenName = () => SCREEN_NAMES[screenRef.current];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetToStart = () => { setScreen('START'); setHistory([]); setCart({}); setPhone(''); };

  const endScenario = (sukces, opis = '') => logger.endScenario({ ekran: screenName(), sukces, opis });
  const startScenario = (sc) => {
    if (!logger.ready()) return;
    if (logger.active()) endScenario(false, 'przerwanie_nowy_scenariusz');
    paidWith.current = '';
    corrections.current = 0;
    resetToStart();
    logger.startScenario(sc);
    setEpoch((n) => n + 1);   // wymusza wiersz „ekran" dla ekranu startowego
  };

  /* skróty prowadzącego: Ctrl+Shift+1/2/3 start scenariusza, E przerwanie, L pobranie CSV, R powrót na start */
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey && e.shiftKey) || !ready) return;
      const map = { Digit1: 'S1', Digit2: 'S2', Digit3: 'S3' };
      if (map[e.code]) { e.preventDefault(); startScenario(map[e.code]); }
      else if (e.code === 'KeyE') { e.preventDefault(); if (logger.active()) endScenario(false, 'przerwanie_prowadzacy'); }
      else if (e.code === 'KeyL') { e.preventDefault(); logger.download(); }
      else if (e.code === 'KeyR') { e.preventDefault(); resetToStart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);
  useEffect(() => { window.__biletomatLog = () => logger.rows(); }, []);

  /* każde dotknięcie (także poza panelem): element, współrzędne, trafienie, AOI */
  useEffect(() => {
    const onDown = (e) => {
      if (!logger.active() || !rootRef.current) return;
      const inside = rootRef.current.contains(e.target);
      const el = inside && e.target.closest ? e.target.closest('[data-id]') : null;
      const x = Math.round(e.clientX), y = Math.round(e.clientY);
      let element = inside ? 'tlo' : 'poza_ekranem', etykieta = '', trafienie = 0;
      if (el) { element = elementName(el); etykieta = labelOf(el); trafienie = el.dataset.disabled === '1' ? 0 : 1; }
      let aoi = '';
      aoiRef.current.forEach((v) => { if (!aoi && x >= v.x && x <= v.x + v.szer && y >= v.y && y <= v.y + v.wys) aoi = v.aoi; });
      logger.emit('dotkniecie', { ekran: screenName(), element, etykieta, x, y, trafienie, aoi, opis: e.pointerType || 'touch' });
      if (el && trafienie && el.dataset.id === 'pay_card') paidWith.current = 'card';
      if (el && trafienie && el.dataset.id === 'key_back') corrections.current += 1;
    };
    const onErr = (e) => { if (logger.ready()) logger.emit('blad', { ekran: screenName(), element: 'JS', etykieta: String(e.message || e).slice(0, 120) }); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('error', onErr);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('error', onErr); };
  }, []);

  /* wejście na ekran, AOI (pojawienie, zmiana położenia, zniknięcie) i koniec scenariusza; po każdym renderze */
  useEffect(() => {
    if (!logger.active() || !rootRef.current) { aoiRef.current.clear(); lastScreenKey.current = ''; return; }
    const sc = logger.scenario();
    const key = `${screen}#${epoch}#${sc}`;
    if (lastScreenKey.current !== key) {
      lastScreenKey.current = key;
      aoiRef.current.clear();   // wejście na nowy ekran kończy AOI poprzedniego
      logger.emit('ekran', { ekran: SCREEN_NAMES[screen], ...rectOf(rootRef.current) });
      if (SCENARIO_END_SCREEN[sc] === screen) {
        const g = SCENARIO_GOALS[sc], st = stateRef.current;
        let ok = false, opis = '';
        if (sc === 'S1') ok = sameCart(st.cart, g.cart) && paidWith.current === g.pay;
        if (sc === 'S2') ok = sameCart(st.cart, g.cart);
        if (sc === 'S3') ok = (!g.id || st.phone === g.id) && corrections.current >= g.minCorrections;
        if (!ok) opis = sc === 'S3' ? `poprawki=${corrections.current} identyfikator=${st.phone}` : 'koszyk=' + Object.entries(st.cart).map(([k, v]) => k + 'x' + v.qty).join(',');
        logger.endScenario({ ekran: SCREEN_NAMES[screen], sukces: ok, opis });
        return;
      }
    }
    AOI_DEFS.forEach((d) => {
      const k = d.aoi + '|' + d.id;
      const active = (!d.screen || d.screen === screen) && (!d.scenario || d.scenario === sc);
      const el = active ? rootRef.current.querySelector(`[data-id="${d.id}"]`) : null;
      const prev = aoiRef.current.get(k);
      if (el) {
        const r = rectOf(el);
        if (!prev || prev.x !== r.x || prev.y !== r.y || prev.szer !== r.szer || prev.wys !== r.wys) {
          logger.emit('aoi', { ekran: SCREEN_NAMES[screen], element: elementName(el), etykieta: labelOf(el), aoi: d.aoi, ...r });
          aoiRef.current.set(k, { ...r, aoi: d.aoi });
        }
      } else if (prev) {
        logger.emit('aoi_znika', { ekran: SCREEN_NAMES[screen], element: ELEMENT_NAMES[d.id] || d.id, aoi: d.aoi });
        aoiRef.current.delete(k);
      }
    });
  });

  useEffect(() => { document.title = ready ? `${VERSION} | ${logger.fileName()}` : 'Biletomat – wersja A'; }, [ready, epoch]);


  const idleRef = useRef(null);
  useEffect(() => {
    if (!IDLE_TIMEOUT_S || screen === 'START') return;
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => { if (logger.active()) logger.emit('blad', { ekran: screenName(), element: 'LIMIT_CZASU', etykieta: 'Upłynął limit bezczynności' }); resetToStart(); }, IDLE_TIMEOUT_S * 1000);
    return () => clearTimeout(idleRef.current);
  }, [screen, cart, phone]);


  const go = (next) => {
    if (!['START', 'DRUK', 'KONIEC'].includes(screen)) setHistory((h) => [...h, screen]);
    setScreen(next);
  };
  const goBack = () => {
    if (history.length > 0) { setScreen(history[history.length - 1]); setHistory(history.slice(0, -1)); }
    else resetToStart();
  };


  const updateCart = (key, name, price, delta) => {
    setCart((prev) => {
      const q = (prev[key] ? prev[key].qty : 0) + delta;
      if (q <= 0) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { name, price, qty: q } };
    });
  };
  const cartItems = Object.values(cart);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const qty = (key) => (cart[key] ? cart[key].qty : 0);


  const pressKey = (v) => {
    if (v === 'back') setPhone((p) => p.slice(0, -1));
    else setPhone((p) => (p.length < MAX_ID_LENGTH ? p + v : p));
  };

  /* Oryginał: poprawny numer jest pokazany normalnie, a dla nieprawidłowego (np. 000000000) ukryty błąd wyświetla „4.8e+10”, bez żadnego komunikatu.
   Założenie: numer zaczynający się od 0 jest nieprawidłowy. */
  const isValidId = (n) => !/^0/.test(n);
  const accountIdDisplay = () => (isValidId(phone) ? '+48 ' + phone : Number('48' + (phone || '0')).toExponential(1));


  useEffect(() => {
    if (screen === 'DRUK') { const id = setTimeout(() => setScreen('KONIEC'), AUTO_PRINT_MS); return () => clearTimeout(id); }
    if (screen === 'KONIEC') { const id = setTimeout(resetToStart, AUTO_END_MS); return () => clearTimeout(id); }
  }, [screen]);

  const dateText = formatDate(now);
  const backBtn = <CornerButton key="b" id="btn_back" aoi="AOI_wstecz" icon={<ArrowLeft size={22} />} label={t.btnBack} onClick={goBack} />;
  const cancelBtn = (disabled) => <CornerButton key="c" id="btn_cancel" icon={<X size={24} />} label={t.btnCancel} onClick={resetToStart} disabled={disabled} />;


  const ticketList = (kind) => {
    const discount = kind === 'discount';
    return (
      <div className="absolute" style={{ left: 270, right: 24, top: 118 }}>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
          {discount ? t.typeDiscount : t.typeNormal}
        </div>
        {TICKETS.map((tk, i) => {
          const price = discount ? tk.discount : tk.normal;
          const word = discount ? t.discountWord : t.normalWord;

          const quirk = !discount && tk.id === '15' && lang === 'PL';
          const name = `${t[tk.key]} ${word} ${quirk ? '-' : ' '}${t.zone}`;
          const key = `${kind}_${tk.id}`;
          return (
            <div key={key} className="flex items-center" style={{ height: 68, marginBottom: 6 }}>
              <div className="flex-1 relative" style={{ height: 64, background: C.btn, border: `1px solid ${C.btnBorder}`, borderRadius: 3, padding: '4px 8px' }}>
                <div style={{ fontSize: 11, color: C.textSoft, maxWidth: 360 }}>{name}</div>
                <div style={{ position: 'absolute', right: 10, bottom: 4, fontSize: 18, fontWeight: 700 }}>{formatPrice(price)}</div>
              </div>
              <button data-id={`minus_${key}`} data-aoi="" data-disabled={qty(key) === 0 ? '1' : '0'}
                onClick={() => qty(key) > 0 && updateCart(key, name, price, -1)}
                style={{ width: 60, height: 60, marginLeft: 14, fontSize: 28, background: C.disabledBg, color: C.disabledText, border: `1px solid ${C.btnBorder}`, borderRadius: 3 }}>-</button>
              <div style={{ width: 44, textAlign: 'center', fontSize: 26, fontWeight: 700 }}>{qty(key)}</div>
              <button data-id={`plus_${key}`} data-aoi="AOI_plus"
                onClick={() => updateCart(key, name, price, 1)}
                style={{ width: 60, height: 60, fontSize: 30, background: C.btn, border: `1px solid ${C.btnBorder}`, borderRadius: 3 }}>+</button>
            </div>
          );
        })}
        {cartItems.length > 0 && (
          <button data-id="btn_next" onClick={() => go('PLATNOSC_WYB')}
            style={{ position: 'absolute', right: 0, top: 410, padding: '14px 40px', fontSize: 20, fontWeight: 700, background: C.btn, border: '2px solid #888', borderRadius: 4 }}>
            {t.btnNext}
          </button>
        )}
      </div>
    );
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];

  return (
    <div className="w-screen h-screen flex items-center justify-center" style={{ background: '#bdbdbd', fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <div style={{ width: 1024 * SCALE, height: 768 * SCALE }}>
        <div
          ref={rootRef}
          className="relative overflow-hidden select-none"
          style={{ width: 1024, height: 768, background: C.bg, color: C.text, transform: `scale(${SCALE})`, transformOrigin: 'top left', border: '2px solid #777', boxSizing: 'border-box' }}
        >
          <Background />

          { }
          {screen === 'START' && (
            <div data-id="start" data-label="Rozpocznij" className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: 90, cursor: 'pointer' }}
              onClick={() => go('MENU')}>
              {assetOk('startLogo') ? (
                <AssetImg k="startLogo" style={{ width: 360 }} fallback={null} />
              ) : (
                <div className="flex items-end" style={{ gap: 16 }}>
                  <NeutralMark size={150} />
                  <div>
                    <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: 8, color: '#2f2f2f', lineHeight: 1 }}>CITY TICKET</div>
                    <div style={{ fontSize: 26, letterSpacing: 6, color: '#555', marginTop: 8 }}>KOMUNIKACJA MIEJSKA</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 15, color: '#555', marginTop: 50, marginLeft: 10 }}>{t.start}</div>
            </div>
          )}

          { }
          {screen === 'MENU' && (
            <>
              <Header dateText={dateText}><Flags lang={lang} setLang={setLang} /></Header>
              <Panel />
              <div className="absolute" style={{ left: 270, right: 24, top: 118 }}>
                <MenuButton id="menu_czasowe" aoi="AOI_menu_czasowe" onClick={() => go('CZASOWE')}>{t.menuTime}</MenuButton>
                <MenuButton id="menu_okresowe" aoi="AOI_menu_okresowe" onClick={() => go('OKRESOWE')}>{t.menuSeason}</MenuButton>
                <MenuButton id="menu_inna" disabled>{t.menuOther}</MenuButton>
              </div>
              <PartnersBand />
            </>
          )}

          { }
          {screen === 'CZASOWE' && (
            <>
              <Header dateText={dateText}>{cancelBtn(false)}</Header>
              <Panel />
              <div className="absolute" style={{ left: 270, right: 24, top: 118 }}>
                <MenuButton id="type_normal" onClick={() => go('CZASOWE_NORM')} h={58}>{t.typeNormal}</MenuButton>
                <MenuButton id="type_discount" onClick={() => go('CZASOWE_ULG')} h={58}>{t.typeDiscount}</MenuButton>
              </div>
            </>
          )}

          { }
          {screen === 'CZASOWE_NORM' && (<><Header dateText={dateText}>{backBtn}{cancelBtn(false)}</Header><Panel />{ticketList("normal")}</>)}
          {screen === 'CZASOWE_ULG' && (<><Header dateText={dateText}>{backBtn}{cancelBtn(false)}</Header><Panel />{ticketList("discount")}</>)}

          { }
          {screen === 'PLATNOSC_WYB' && (
            <>
              <Header dateText={dateText}>{cancelBtn(false)}</Header>
              <Panel>
                <div className="absolute" style={{ left: 4, right: 4, bottom: 6, background: 'rgba(244,240,225,0.92)', border: `1px solid ${C.line}`, padding: '4px 6px', minHeight: 70 }}>
                  {cartItems.map((it, i) => (
                    <div key={i} className="flex justify-between" style={{ fontSize: 9, color: C.textFaint }}>
                      <span>{it.name}</span><span style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>{it.qty}x{it.price.toFixed(2).replace('.', ',')} zł</span>
                    </div>
                  ))}
                  <div className="flex" style={{ fontSize: 9, color: C.textFaint, marginTop: 8 }}>
                    <span style={{ width: 70, textAlign: 'right', marginRight: 6 }}>{t.total}</span><span>{formatPrice(total)}</span>
                  </div>
                </div>
              </Panel>
              <div className="absolute" style={{ left: 270, right: 24, top: 118 }}>
                <MenuButton id="pay_card" aoi="AOI_zaplac_karta" onClick={() => go('PLATNOSC')} h={64} size={21}>{t.payCard}</MenuButton>
                <MenuButton id="pay_cash" onClick={() => { }} h={64} size={21}>{t.payCash}</MenuButton>
              </div>
            </>
          )}

          { }
          {screen === 'PLATNOSC' && (
            <>
              <Header dateText={dateText}>{cancelBtn(true)}</Header>
              <Panel />
              <div className="absolute flex flex-col items-center" style={{ left: 270, right: 24, top: 140 }}>
                <div style={{ fontSize: 30 }}>{t.payTotal}: <b>{formatPrice(total)}</b></div>
                <div data-id="sim_card" onClick={() => go('DRUK')}
                  style={{ marginTop: 34, width: 230, height: 160, background: '#202020', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Wifi size={70} style={{ transform: 'rotate(90deg)' }} />
                  <div style={{ marginTop: 10, background: '#2a56a8', fontSize: 14, padding: '2px 14px', fontWeight: 700 }}>PAY</div>
                </div>
                <div style={{ marginTop: 22, fontSize: 15, color: C.textSoft, textAlign: 'center', whiteSpace: 'pre-line' }}>{t.payInst}</div>
                <div style={{ marginTop: 18, fontSize: 11, color: C.textFaint }}>({t.simHint})</div>
              </div>
            </>
          )}

          { }
          {screen === 'DRUK' && (
            <>
              <Header dateText={dateText}></Header>
              <Panel />
              <div className="absolute flex flex-col items-center" style={{ left: 270, right: 24, top: 220 }}>
                <Loader2 size={130} className="animate-spin" style={{ color: '#888' }} />
                <div style={{ marginTop: 28, fontSize: 20, fontWeight: 500 }}>{t.printWait}</div>
              </div>
            </>
          )}

          { }
          {screen === 'KONIEC' && (
            <>
              <Header dateText={dateText}>
                <CornerButton id="btn_end" icon={<X size={24} />} label={t.btnEnd} onClick={resetToStart} />
              </Header>
              <Panel />
              <div className="absolute flex flex-col items-center" style={{ left: 270, right: 24, top: 190 }}>
                <Smile size={190} strokeWidth={1.4} style={{ color: '#111' }} />
                <div style={{ marginTop: 20, fontSize: 22, fontWeight: 700 }}>{t.doneMsg}</div>
                <button data-id="btn_receipt" style={{ marginTop: 14, padding: '14px 26px', fontSize: 16, background: C.btn, border: `1px solid ${C.btnBorder}`, borderRadius: 3, color: C.textSoft }}>{t.doneRec}</button>
              </div>
            </>
          )}

          { }
          {screen === 'OKRESOWE' && (
            <>
              <Header dateText={dateText}>{backBtn}{cancelBtn(false)}</Header>
              <div className="absolute flex flex-col" style={{ left: 16, top: 118, width: 300, height: 560, gap: 10 }}>
                <div className="flex-1 flex items-center justify-center text-center" style={{ border: `1px solid ${C.btnBorder}`, background: C.btn, fontSize: 18, fontWeight: 300, color: C.textSoft, padding: 20 }}>{t.tileCard}</div>
                <div className="flex-1 flex items-center justify-center text-center" style={{ border: `1px solid ${C.btnBorder}`, background: C.btn, fontSize: 18, fontWeight: 300, color: C.textSoft, padding: 20, whiteSpace: 'pre-line' }}>{t.tileQr}</div>
              </div>
              <div className="absolute flex flex-col items-center" style={{ left: 340, right: 24, top: 118, height: 560, border: `1px solid ${C.btnBorder}`, background: C.btn, padding: 14 }}>
                <div style={{ fontSize: 15, textAlign: 'center', whiteSpace: 'pre-line', color: C.textSoft }}>{t.seasonDesc}</div>
                <div data-id="field_number" data-label="Pole numeru" data-aoi="AOI_pole_numeru" style={{ marginTop: 16, width: 330, height: 54, background: '#fff', border: `1px solid ${C.btnBorder}`, fontSize: 28, display: 'flex', alignItems: 'center', padding: '0 12px', letterSpacing: 2 }}>
                  +48 {phone}
                </div>
                <div className="grid" style={{ marginTop: 18, gridTemplateColumns: 'repeat(3, 100px)', gap: 8 }}>
                  {keypad.map((k) => {
                    if (k === 'ok') {
                      const ok = phone.length >= MIN_ID_LENGTH;
                      return (
                        <button key="ok" data-id="key_ok" data-aoi="AOI_ok" data-disabled={ok ? '0' : '1'}
                          onClick={() => ok && go('OKRESOWE_KONTO')}
                          style={{ height: 70, fontSize: 22, background: ok ? C.btn : C.disabledBg, color: ok ? C.text : C.disabledText, border: `1px solid ${C.btnBorder}`, borderRadius: 3 }}>OK</button>
                      );
                    }
                    return (
                      <button key={k} data-id={k === 'back' ? 'key_back' : 'key_' + k} data-aoi={k === 'back' ? 'AOI_cofnij_znak' : ''}
                        onClick={() => pressKey(k)}
                        style={{ height: 70, fontSize: 26, background: '#fff', border: `1px solid ${C.btnBorder}`, borderRadius: 3 }}>
                        {k === 'back' ? '←' : k}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          { }
          {screen === 'OKRESOWE_KONTO' && (
            <>
              <Header dateText={dateText}>{backBtn}{cancelBtn(false)}</Header>
              <div className="absolute" style={{ left: 24, top: 124, width: 640 }}>
                <div style={{ fontSize: 16, fontWeight: 500, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>
                  {t.seasonId}: <b>{accountIdDisplay()}</b>
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: C.textFaint, border: `1px solid ${C.line}`, padding: '2px 6px' }}>{t.wallet}</div>
                <div className="flex items-center justify-center" style={{ height: 190, fontSize: 20, border: `1px solid ${C.line}`, borderTop: 0 }}>
                  {t.seasonFunds}: <b style={{ marginLeft: 8 }}>0,00 zł</b>
                </div>
                <div style={{ fontSize: 10, color: C.textFaint, border: `1px solid ${C.line}`, borderTop: 0, padding: '2px 6px' }}>{t.seasonFooter}</div>
              </div>
              <div className="absolute flex flex-col" style={{ right: 24, top: 124, width: 250, gap: 10 }}>
                <MenuButton id="btn_topup" aoi="AOI_doladuj" onClick={() => { }} h={64} size={20}>{t.seasonTopup}</MenuButton>
                <MenuButton id="btn_buy" onClick={() => { }} h={64} size={20}>{t.seasonBuy}</MenuButton>
              </div>
            </>
          )}
        </div>
      </div>
      {!ready && (
        <SessionSetup logger={logger} interfejs={INTERFACE_NO} wersja={VERSION}
          onStart={({ uczestnik, kolejnosc }) => {
            const dpr = Math.round(window.devicePixelRatio * 100);
            logger.begin({ uczestnik, kolejnosc, opis: `skalowanie=${dpr}% okno=${window.innerWidth}x${window.innerHeight} ekran=${window.screen.width}x${window.screen.height}` });
            setReady(true);
          }} />
      )}
    </div>
  );
}
