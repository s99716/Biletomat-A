import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X, Wifi, Smile, Loader2, Clock, CalendarDays, User, Percent, CreditCard, Banknote, QrCode, Plus, Minus, Check, Printer, Delete, Ticket, AlertTriangle, Accessibility } from 'lucide-react';
import { createLogger } from './eventLogger.js';
import SessionSetup from './SessionSetup.jsx';

const SCALE = 1;
const AUTO_PRINT_MS = 3000;
const AUTO_END_MS = 3000;
/* limit bezczynności wersji B: ostrzeżenie WARN_BEFORE_S sekund przed końcem (parametr ?idle=SEK do testów) */
const IDLE_TIMEOUT_S = Number(new URLSearchParams(window.location.search).get('idle')) || 90;
const WARN_BEFORE_S = Math.min(30, Math.floor(IDLE_TIMEOUT_S / 2));
const MIN_ID_LENGTH = 9;
const MAX_ID_LENGTH = 12;

/* ---------- REJESTROWANIE ZDARZEŃ (PUN_zdarzenia) ---------- */
const INTERFACE_NO = 4;           // numer interfejsu z Tabeli 1 harmonogramu
const VERSION = 'B';
const logger = createLogger({ interfejs: INTERFACE_NO, wersja: VERSION });

/* Cele scenariuszy dla wersji A (Tabela 7). Zmień tutaj, jeśli scenariusz się zmieni. */
const SCENARIO_GOALS = {
  S1: { cart: { normal_90: 1 }, pay: 'card' },   // 1 bilet 90-min normalny, karta; koniec: ekran wydruku
  S2: { cart: { discount_15: 3 } },              // 3 bilety 15-min ulgowe; koniec: ekran wyboru płatności
  S3: { id: null, minCorrections: 1 },   // sukces: użyto cofania znaku (poprawka) i dotarto do konta; ustaw id, aby dodatkowo wymagać konkretnego numeru
};
const SCENARIO_END_SCREEN = { S1: 'DRUK', S2: 'PLATNOSC_WYB', S3: 'OKRESOWE_KONTO' };

const SCREEN_NAMES = {
  START: 'start', MENU: 'menu', CZASOWE: 'czasowe', CZASOWE_NORM: 'czasowe_normalne',
  CZASOWE_ULG: 'czasowe_ulgowe', PLATNOSC_WYB: 'wybor_platnosci', PODSUMOWANIE: 'podsumowanie', PLATNOSC: 'platnosc',
  DRUK: 'druk', KONIEC: 'koniec', OKRESOWE: 'okresowe', OKRESOWE_KONTO: 'okresowe_konto',
};
/* Wspólna lista AOI. AOI_cel zależy od scenariusza (Tabela 7). */
const AOI_DEFS = [
  { aoi: 'AOI_wstecz', id: 'btn_back' },
  { aoi: 'AOI_dostepnosc', id: 'extend' },
  { aoi: 'AOI_dostepnosc', id: 'a11y_open' },
  { aoi: 'AOI_cel', id: 'pay_card', screen: 'PLATNOSC_WYB', scenario: 'S1' },
  { aoi: 'AOI_cel', id: 'plus_discount_15', screen: 'CZASOWE_ULG', scenario: 'S2' },
  { aoi: 'AOI_cel', id: 'key_back', screen: 'OKRESOWE', scenario: 'S3' },
  { aoi: 'AOI_blad', id: 'komunikat_bledu', screen: 'OKRESOWE' },
];
const ELEMENT_NAMES = { btn_back: 'wstecz', btn_cancel: 'anuluj', btn_next: 'dalej', btn_end: 'koniec', a11y_open: 'dostepnosc', a11y_close: 'gotowe', btn_pay: 'zaplac', extend: 'przedluz', timeout_end: 'zakoncz_sesje', key_back: 'klawisz_cofnij_znak', key_ok: 'ok', komunikat_bledu: 'komunikat_bledu' };
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
    start: "Dotknij ekranu, aby rozpocząć",
    menuTime: "Bilety czasowe", menuTimeNote: "15 min, 40 min, 90 min, 6 godz., 24 godz.",
    menuSeason: "Bilety okresowe", menuSeasonNote: "Konto miejskie: doładowanie i zakup",
    menuOther: "Inne usługi", menuOtherNote: "Niedostępne",
    btnBack: "Wstecz", btnCancel: "Anuluj", btnNext: "Dalej", btnPay: "Zapłać", btnEnd: "Koniec",
    step: "Krok", of: "z",
    sService: "Wybór usługi", sKind: "Rodzaj biletu", sTickets: "Wybór biletów", sSummary: "Podsumowanie",
    sPayment: "Płatność", sPickup: "Odbiór biletów", sId: "Identyfikator", sAccount: "Konto",
    typeNormal: "Normalny", typeNormalNote: "Pełna cena", typeDiscount: "Ulgowy", typeDiscountNote: "Dla osób uprawnionych do ulgi",
    listNormal: "Bilety normalne", listDiscount: "Bilety ulgowe", zone: "Strefa 1+2",
    normalWord: "normalny", discountWord: "ulgowy", total: "Razem",
    t15: "Bilet 15 min", t40: "Bilet 40 min", t90: "Bilet 90 min", t6h: "Bilet 6 godz.", t24h: "Bilet 24 godz.",
    plusLabel: "Dodaj bilet", minusLabel: "Odejmij bilet",
    summaryTitle: "Sprawdź swoje zamówienie", summaryHint: "Jeśli wszystko się zgadza, dotknij „Zapłać”.",
    payTitle: "Wybierz sposób płatności", payCard: "Płacę kartą lub BLIK", payCash: "Płacę gotówką",
    payTotal: "Do zapłaty", payInst: "Zbliż kartę do terminala płatniczego.",
    simHint: "Dotknij, aby zasymulować zbliżenie karty",
    printWait: "Trwa drukowanie biletów. Proszę czekać.",
    doneMsg: "Dziękujemy. Transakcja zakończona.", doneRec: "Wydrukuj potwierdzenie",
    seasonDesc: "Wpisz numer telefonu (aplikacja) lub numer karty i dotknij „OK”.",
    seasonOkHint: "„OK” będzie aktywne po wpisaniu co najmniej {n} cyfr.",
    idError: "Nieprawidłowy numer. Sprawdź numer telefonu lub karty i popraw go.",
    tileCard: "Włóż kartę do czytnika", tileQr: "Zeskanuj kod QR z aplikacji",
    delLabel: "Cofnij ostatni znak",
    seasonId: "Identyfikator konta", wallet: "Elektroniczna portmonetka",
    seasonFunds: "Środki na koncie", seasonTopup: "Doładuj konto", seasonBuy: "Kup bilet",
    seasonFooter: "Bilety zakupione w systemie biletowym",
    toTitle: "Czy potrzebujesz więcej czasu?", toBody: "Sesja zakończy się za {n} s.",
    toExtend: "Potrzebuję więcej czasu", toEnd: "Zakończ",
    a11yBtn: "Dostępność", a11yTitle: "Ustawienia dostępności", a11yContrast: "Kontrast", a11yFont: "Rozmiar tekstu", themeDefault: "Standardowy", themeWb: "Biały na czarnym", themeYb: "Żółty na czarnym", themeBy: "Czarny na żółtym", fontNormal: "Normalny", fontLarge: "Duży", fontXL: "Bardzo duży", a11yClose: "Gotowe",
  },
  EN: {
    start: "Touch the screen to start",
    menuTime: "Time tickets", menuTimeNote: "15 min, 40 min, 90 min, 6 h, 24 h",
    menuSeason: "Season tickets", menuSeasonNote: "City account: top up and buy",
    menuOther: "Other services", menuOtherNote: "Not available",
    btnBack: "Back", btnCancel: "Cancel", btnNext: "Next", btnPay: "Pay", btnEnd: "Finish",
    step: "Step", of: "of",
    sService: "Choose service", sKind: "Ticket type", sTickets: "Choose tickets", sSummary: "Summary",
    sPayment: "Payment", sPickup: "Collect tickets", sId: "Identifier", sAccount: "Account",
    typeNormal: "Standard", typeNormalNote: "Full price", typeDiscount: "Discounted", typeDiscountNote: "For people entitled to a discount",
    listNormal: "Standard tickets", listDiscount: "Discounted tickets", zone: "Zone 1+2",
    normalWord: "standard", discountWord: "discounted", total: "Total",
    t15: "15-min ticket", t40: "40-min ticket", t90: "90-min ticket", t6h: "6-hour ticket", t24h: "24-hour ticket",
    plusLabel: "Add ticket", minusLabel: "Remove ticket",
    summaryTitle: "Check your order", summaryHint: "If everything is correct, touch “Pay”.",
    payTitle: "Choose how to pay", payCard: "Pay by card or BLIK", payCash: "Pay with cash",
    payTotal: "To pay", payInst: "Hold your card near the payment terminal.",
    simHint: "Touch to simulate tapping the card",
    printWait: "Printing your tickets. Please wait.",
    doneMsg: "Thank you. Transaction completed.", doneRec: "Print receipt",
    seasonDesc: "Enter your phone number (app) or card number and touch “OK”.",
    seasonOkHint: "“OK” becomes active after at least {n} digits.",
    idError: "Invalid number. Check your phone or card number and correct it.",
    tileCard: "Insert the card into the reader", tileQr: "Scan the QR code from the app",
    delLabel: "Delete last digit",
    seasonId: "Account identifier", wallet: "Electronic wallet",
    seasonFunds: "Account balance", seasonTopup: "Top up account", seasonBuy: "Buy ticket",
    seasonFooter: "Tickets bought in the ticketing system",
    toTitle: "Do you need more time?", toBody: "The session will end in {n} s.",
    toExtend: "I need more time", toEnd: "End session",
    a11yBtn: "Accessibility", a11yTitle: "Accessibility settings", a11yContrast: "Contrast", a11yFont: "Text size", themeDefault: "Standard", themeWb: "White on black", themeYb: "Yellow on black", themeBy: "Black on yellow", fontNormal: "Normal", fontLarge: "Large", fontXL: "Extra large", a11yClose: "Done",
  },
  UA: {
    start: "Торкніться екрана, щоб почати",
    menuTime: "Часові квитки", menuTimeNote: "15 хв, 40 хв, 90 хв, 6 год, 24 год",
    menuSeason: "Періодичні квитки", menuSeasonNote: "Міський рахунок: поповнення і купівля",
    menuOther: "Інші послуги", menuOtherNote: "Недоступно",
    btnBack: "Назад", btnCancel: "Скасувати", btnNext: "Далі", btnPay: "Сплатити", btnEnd: "Завершити",
    step: "Крок", of: "з",
    sService: "Вибір послуги", sKind: "Тип квитка", sTickets: "Вибір квитків", sSummary: "Підсумок",
    sPayment: "Оплата", sPickup: "Отримання квитків", sId: "Ідентифікатор", sAccount: "Рахунок",
    typeNormal: "Звичайний", typeNormalNote: "Повна ціна", typeDiscount: "Пільговий", typeDiscountNote: "Для осіб, які мають право на пільгу",
    listNormal: "Звичайні квитки", listDiscount: "Пільгові квитки", zone: "Зона 1+2",
    normalWord: "звичайний", discountWord: "пільговий", total: "Разом",
    t15: "Квиток 15 хв", t40: "Квиток 40 хв", t90: "Квиток 90 хв", t6h: "Квиток 6 год", t24h: "Квиток 24 год",
    plusLabel: "Додати квиток", minusLabel: "Прибрати квиток",
    summaryTitle: "Перевірте замовлення", summaryHint: "Якщо все правильно, торкніться «Сплатити».",
    payTitle: "Оберіть спосіб оплати", payCard: "Оплата карткою або BLIK", payCash: "Оплата готівкою",
    payTotal: "До сплати", payInst: "Піднесіть картку до платіжного терміналу.",
    simHint: "Торкніться, щоб імітувати прикладання картки",
    printWait: "Друкуємо квитки. Зачекайте.",
    doneMsg: "Дякуємо. Транзакцію завершено.", doneRec: "Роздрукувати підтвердження",
    seasonDesc: "Введіть номер телефону (додаток) або номер картки й торкніться «OK».",
    seasonOkHint: "«OK» стане активною після введення щонайменше {n} цифр.",
    idError: "Недійсний номер. Перевірте номер телефону або картки та виправте його.",
    tileCard: "Вставте картку в зчитувач", tileQr: "Скануйте QR-код із додатку",
    delLabel: "Видалити останню цифру",
    seasonId: "Ідентифікатор рахунку", wallet: "Електронний гаманець",
    seasonFunds: "Кошти на рахунку", seasonTopup: "Поповнити рахунок", seasonBuy: "Купити квиток",
    seasonFooter: "Квитки, придбані в системі",
    toTitle: "Вам потрібно більше часу?", toBody: "Сеанс завершиться через {n} с.",
    toExtend: "Мені потрібно більше часу", toEnd: "Завершити",
    a11yBtn: "Доступність", a11yTitle: "Налаштування доступності", a11yContrast: "Контраст", a11yFont: "Розмір тексту", themeDefault: "Стандартний", themeWb: "Білий на чорному", themeYb: "Жовтий на чорному", themeBy: "Чорний на жовтому", fontNormal: "Звичайний", fontLarge: "Великий", fontXL: "Дуже великий", a11yClose: "Готово",
  },

  DE: {
    start: "Bildschirm berühren, um zu beginnen",
    menuTime: "Zeitkarten", menuTimeNote: "15 Min., 40 Min., 90 Min., 6 Std., 24 Std.",
    menuSeason: "Periodenkarten", menuSeasonNote: "Stadtkonto: aufladen und kaufen",
    menuOther: "Weitere Leistungen", menuOtherNote: "Nicht verfügbar",
    btnBack: "Zurück", btnCancel: "Abbrechen", btnNext: "Weiter", btnPay: "Bezahlen", btnEnd: "Beenden",
    step: "Schritt", of: "von",
    sService: "Leistung wählen", sKind: "Ticketart", sTickets: "Tickets wählen", sSummary: "Zusammenfassung",
    sPayment: "Zahlung", sPickup: "Tickets entnehmen", sId: "Kennung", sAccount: "Konto",
    typeNormal: "Normal", typeNormalNote: "Voller Preis", typeDiscount: "Ermäßigt", typeDiscountNote: "Für Berechtigte",
    listNormal: "Normale Tickets", listDiscount: "Ermäßigte Tickets", zone: "Zone 1+2",
    normalWord: "normal", discountWord: "ermäßigt", total: "Gesamt",
    t15: "15-Min.-Ticket", t40: "40-Min.-Ticket", t90: "90-Min.-Ticket", t6h: "6-Std.-Ticket", t24h: "24-Std.-Ticket",
    plusLabel: "Ticket hinzufügen", minusLabel: "Ticket entfernen",
    summaryTitle: "Bestellung prüfen", summaryHint: "Wenn alles stimmt, tippen Sie auf „Bezahlen“.",
    payTitle: "Zahlungsart wählen", payCard: "Mit Karte oder BLIK zahlen", payCash: "Bar zahlen",
    payTotal: "Zu zahlen", payInst: "Halten Sie die Karte an das Zahlungsterminal.",
    simHint: "Tippen, um das Auflegen der Karte zu simulieren",
    printWait: "Tickets werden gedruckt. Bitte warten.",
    doneMsg: "Danke. Vorgang abgeschlossen.", doneRec: "Beleg drucken",
    seasonDesc: "Telefonnummer (App) oder Kartennummer eingeben und „OK“ tippen.",
    seasonOkHint: "„OK“ wird nach mindestens {n} Ziffern aktiv.",
    idError: "Ungültige Nummer. Prüfen Sie Telefon- oder Kartennummer und korrigieren Sie sie.",
    tileCard: "Karte in den Leser einführen", tileQr: "QR-Code aus der App scannen",
    delLabel: "Letzte Ziffer löschen",
    seasonId: "Kontokennung", wallet: "Elektronische Geldbörse",
    seasonFunds: "Guthaben", seasonTopup: "Konto aufladen", seasonBuy: "Ticket kaufen",
    seasonFooter: "Im Ticketsystem gekaufte Tickets",
    toTitle: "Brauchen Sie mehr Zeit?", toBody: "Die Sitzung endet in {n} s.",
    toExtend: "Ich brauche mehr Zeit", toEnd: "Sitzung beenden",
    a11yBtn: "Barrierefreiheit", a11yTitle: "Einstellungen zur Barrierefreiheit", a11yContrast: "Kontrast", a11yFont: "Textgröße", themeDefault: "Standard", themeWb: "Weiß auf Schwarz", themeYb: "Gelb auf Schwarz", themeBy: "Schwarz auf Gelb", fontNormal: "Normal", fontLarge: "Groß", fontXL: "Sehr groß", a11yClose: "Fertig",
  },
  ES: {
    start: "Toque la pantalla para empezar",
    menuTime: "Billetes por tiempo", menuTimeNote: "15 min, 40 min, 90 min, 6 h, 24 h",
    menuSeason: "Abonos", menuSeasonNote: "Cuenta urbana: recargar y comprar",
    menuOther: "Otros servicios", menuOtherNote: "No disponible",
    btnBack: "Atrás", btnCancel: "Cancelar", btnNext: "Siguiente", btnPay: "Pagar", btnEnd: "Finalizar",
    step: "Paso", of: "de",
    sService: "Elegir servicio", sKind: "Tipo de billete", sTickets: "Elegir billetes", sSummary: "Resumen",
    sPayment: "Pago", sPickup: "Recoger billetes", sId: "Identificador", sAccount: "Cuenta",
    typeNormal: "Normal", typeNormalNote: "Precio completo", typeDiscount: "Reducido", typeDiscountNote: "Para quienes tienen derecho a descuento",
    listNormal: "Billetes normales", listDiscount: "Billetes reducidos", zone: "Zona 1+2",
    normalWord: "normal", discountWord: "reducido", total: "Total",
    t15: "Billete de 15 min", t40: "Billete de 40 min", t90: "Billete de 90 min", t6h: "Billete de 6 h", t24h: "Billete de 24 h",
    plusLabel: "Añadir billete", minusLabel: "Quitar billete",
    summaryTitle: "Revise su pedido", summaryHint: "Si todo es correcto, toque «Pagar».",
    payTitle: "Elija cómo pagar", payCard: "Pagar con tarjeta o BLIK", payCash: "Pagar en efectivo",
    payTotal: "A pagar", payInst: "Acerque la tarjeta al terminal de pago.",
    simHint: "Toque para simular el acercamiento de la tarjeta",
    printWait: "Imprimiendo billetes. Espere.",
    doneMsg: "Gracias. Operación finalizada.", doneRec: "Imprimir comprobante",
    seasonDesc: "Escriba su número de teléfono (app) o de tarjeta y toque «OK».",
    seasonOkHint: "«OK» se activa tras escribir al menos {n} dígitos.",
    idError: "Número no válido. Compruebe su número de teléfono o de tarjeta y corríjalo.",
    tileCard: "Inserte la tarjeta en el lector", tileQr: "Escanee el código QR de la app",
    delLabel: "Borrar el último dígito",
    seasonId: "Identificador de cuenta", wallet: "Monedero electrónico",
    seasonFunds: "Saldo de la cuenta", seasonTopup: "Recargar cuenta", seasonBuy: "Comprar billete",
    seasonFooter: "Billetes comprados en el sistema de billetaje",
    toTitle: "¿Necesita más tiempo?", toBody: "La sesión terminará en {n} s.",
    toExtend: "Necesito más tiempo", toEnd: "Terminar sesión",
    a11yBtn: "Accesibilidad", a11yTitle: "Ajustes de accesibilidad", a11yContrast: "Contraste", a11yFont: "Tamaño del texto", themeDefault: "Estándar", themeWb: "Blanco sobre negro", themeYb: "Amarillo sobre negro", themeBy: "Negro sobre amarillo", fontNormal: "Normal", fontLarge: "Grande", fontXL: "Muy grande", a11yClose: "Listo",
  },
};

const TICKETS = [
  { id: '15', key: 't15', icon: 'clock', normal: 3.4, discount: 1.7 },
  { id: '40', key: 't40', icon: 'clock', normal: 4.6, discount: 2.3 },
  { id: '90', key: 't90', icon: 'clock', normal: 5.2, discount: 2.6 },
  { id: '6h', key: 't6h', icon: 'clock', normal: 9.0, discount: 4.5 },
  { id: '24h', key: 't24h', icon: 'clock', normal: 14.2, discount: 7.1 },
];

/* Kontrast tekstu ≥ 7:1 (WCAG 1.4.6): ciemne teksty na jasnym tle, przyciski główne białe na granatowym (ok. 10:1).
   Elementy nieaktywne: przerywana ramka + ciemnoszary tekst na szarym tle (ok. 8:1), więc też czytelne. */
const THEMES = {
  default: { bg: '#f7f4ea', bar: '#e4e0d1', line: '#1a1a1a', btn: '#ffffff', btnBorder: '#1a1a1a', text: '#111111', textSoft: '#222222',
    primary: '#1f3d8a', primaryText: '#ffffff', disabledBg: '#e2e2e2', disabledText: '#3d3d3d', track: '#d8d8d8', trackBorder: '#444444', plate: 'transparent', pattern: true },
  wb: { bg: '#000000', bar: '#000000', line: '#ffffff', btn: '#000000', btnBorder: '#ffffff', text: '#ffffff', textSoft: '#ffffff',
    primary: '#ffffff', primaryText: '#000000', disabledBg: '#1c1c1c', disabledText: '#c8c8c8', track: '#333333', trackBorder: '#ffffff', plate: '#ffffff', pattern: false },
  yb: { bg: '#000000', bar: '#000000', line: '#ffe600', btn: '#000000', btnBorder: '#ffe600', text: '#ffe600', textSoft: '#ffe600',
    primary: '#ffe600', primaryText: '#000000', disabledBg: '#1c1c1c', disabledText: '#d4c200', track: '#333333', trackBorder: '#ffe600', plate: '#ffffff', pattern: false },
  by: { bg: '#ffe600', bar: '#ffe600', line: '#000000', btn: '#ffe600', btnBorder: '#000000', text: '#000000', textSoft: '#000000',
    primary: '#000000', primaryText: '#ffe600', disabledBg: '#cdb900', disabledText: '#000000', track: '#fff3a0', trackBorder: '#000000', plate: '#ffffff', pattern: false },
};
/* Motyw i rozmiar tekstu ustawia komponent główny przy każdym renderze (ustawienia dostępności). */
let C = THEMES.default;
const FONT_SCALES = [1, 1.2, 1.4];
let FS = 1;
const fz = (n, cap = 9) => Math.round(n * Math.min(FS, cap));

const formatPrice = (p) => p.toFixed(2).replace('.', ',') + ' zł';
const formatDate = (date) => {
  const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const p = (n) => String(n).padStart(2, '0');
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
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

/* ---------- KOMPONENTY UI WERSJI B ---------- */
const MIN_TARGET = 44;   // WCAG 2.5.5: żaden cel dotykowy nie jest mniejszy niż 44 x 44 px; główne mają 64-96 px

const Btn = ({ id, aoi, icon, children, onClick, disabled, primary, w, h = 72, size = 22, label, selected, full, cap }) => (
  <button
    data-id={id} data-aoi={aoi || ''} data-disabled={disabled ? '1' : '0'} aria-label={label}
    aria-disabled={disabled ? 'true' : undefined} aria-pressed={selected === undefined ? undefined : selected}
    onClick={disabled ? undefined : onClick}
    className="flex items-center justify-center"
    style={{
      minWidth: Math.max(w || MIN_TARGET, MIN_TARGET), width: full ? '100%' : undefined, height: Math.max(h, MIN_TARGET), padding: '0 16px', gap: 10,
      fontSize: fz(size, cap), fontWeight: 700, borderRadius: 6,
      background: disabled ? C.disabledBg : primary ? C.primary : C.btn,
      color: disabled ? C.disabledText : primary ? C.primaryText : C.text,
      border: disabled ? `3px dashed ${C.disabledText}` : `${selected ? 7 : 3}px solid ${primary ? C.primary : C.btnBorder}`,
    }}
  >
    {selected && <Check size={26} aria-hidden="true" />}{icon}{children}
  </button>
);

const BigChoice = ({ id, icon, title, note, onClick, disabled, h = 96 }) => (
  <button
    data-id={id} data-disabled={disabled ? '1' : '0'} aria-disabled={disabled ? 'true' : undefined}
    onClick={disabled ? undefined : onClick}
    className="flex items-center text-left"
    style={{
      width: '100%', height: h, marginBottom: 14, padding: '0 22px', gap: 20, borderRadius: 6,
      background: disabled ? C.disabledBg : C.btn, color: disabled ? C.disabledText : C.text,
      border: disabled ? `3px dashed ${C.disabledText}` : `3px solid ${C.btnBorder}`,
    }}
  >
    <div style={{ flex: '0 0 auto' }}>{icon}</div>
    <div>
      <div style={{ fontSize: fz(30), fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
      {note && <div style={{ fontSize: fz(19), marginTop: 4 }}>{note}</div>}
    </div>
  </button>
);

const Flag = ({ id, code, name, active, onClick, children }) => (
  <button
    data-id={id} data-label={code} aria-label={name} aria-pressed={active} onClick={onClick}
    className="flex flex-col items-center"
    style={{ width: 68, height: 60, padding: 3, background: C.btn, border: active ? `4px solid ${C.line}` : `2px solid ${C.disabledText}`, borderRadius: 6 }}
  >
    <div style={{ width: 54, height: 34, overflow: 'hidden', border: `1px solid ${C.line}` }}>{children}</div>
    <div style={{ fontSize: /*bez skali*/ 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{code}</div>
  </button>
);

const stripes = (cols, ratio) => (
  <div style={{ height: '100%' }}>{cols.map((c, i) => <div key={i} style={{ height: `${ratio[i]}%`, background: c }} />)}</div>
);

const Flags = ({ lang, setLang }) => (
  <div className="flex" style={{ gap: 6 }}>
    <Flag id="lang_PL" code="PL" name="Polski" active={lang === 'PL'} onClick={() => setLang('PL')}>{stripes(['#fff', '#d4213d'], [50, 50])}</Flag>
    <Flag id="lang_EN" code="EN" name="English" active={lang === 'EN'} onClick={() => setLang('EN')}>
      <svg viewBox="0 0 60 30" width="100%" height="100%">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="2.5" />
        <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </svg>
    </Flag>
    <Flag id="lang_UA" code="UA" name="Українська" active={lang === 'UA'} onClick={() => setLang('UA')}>{stripes(['#3b7bd6', '#f3c613'], [50, 50])}</Flag>
    <Flag id="lang_DE" code="DE" name="Deutsch" active={lang === 'DE'} onClick={() => setLang('DE')}>{stripes(['#000', '#d00', '#ffce00'], [33, 34, 33])}</Flag>
    <Flag id="lang_ES" code="ES" name="Español" active={lang === 'ES'} onClick={() => setLang('ES')}>{stripes(['#aa151b', '#f1bf00', '#aa151b'], [25, 50, 25])}</Flag>
  </div>
);

const Header = ({ dateText, children }) => (
  <>
    <div className="absolute left-0 top-0 w-full" style={{ height: 78 }}>
      <div className="absolute" style={{ left: 24, top: 18, background: C.plate, padding: C.plate === 'transparent' ? 0 : '3px 8px', borderRadius: 6 }}><HeaderLogos /></div>
      <div className="absolute flex" style={{ right: 20, top: 8, gap: 8 }}>{children}</div>
    </div>
    <div className="absolute left-0 w-full" style={{ top: 80, height: 28, background: C.bar, borderBottom: `2px solid ${C.line}` }}>
      <div style={{ position: 'absolute', right: 18, top: 3, fontSize: fz(16, 1.2), fontWeight: 700, color: C.text }}>{dateText}</div>
    </div>
  </>
);

/* wskaźnik postępu „Krok X z N” (WCAG 2.4.8); w menu głównym ścieżka jeszcze nie jest wybrana, więc bez sumy */
const Progress = ({ step, total, label, t }) => (
  <div className="absolute" style={{ left: 24, right: 24, top: 114, height: 46 }}>
    <div style={{ fontSize: fz(21, 1.2), fontWeight: 700, color: C.text }}>
      {t.step} {step}{total ? ` ${t.of} ${total}` : ''}: {label}
    </div>
    {total ? (
      <div className="flex" style={{ gap: 6, marginTop: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 9, background: i < step ? C.primary : C.track, border: `1px solid ${C.trackBorder}` }} />
        ))}
      </div>
    ) : null}
  </div>
);

/* stały pasek nawigacji na dole: Wstecz i Anuluj po lewej, akcja główna po prawej */
const NavBar = ({ back, cancel, primary, onA11y, t }) => (
  <div className="absolute flex items-center" style={{ left: 24, right: 24, bottom: 18, height: 76, gap: 12 }}>
    {back && <Btn id="btn_back" aoi="AOI_wstecz" w={160} cap={1.15} icon={<ArrowLeft size={30} />} onClick={back}>{t.btnBack}</Btn>}
    {cancel && <Btn id="btn_cancel" w={160} cap={1.15} icon={<X size={30} />} onClick={cancel}>{t.btnCancel}</Btn>}
    <Btn id="a11y_open" w={190} cap={1.15} icon={<Accessibility size={30} />} onClick={onA11y}>{t.a11yBtn}</Btn>
    <div className="flex-1" />
    {primary && <Btn id={primary.id} w={230} cap={1.15} primary={!primary.disabled} disabled={primary.disabled} icon={primary.icon} onClick={primary.onClick}>{primary.label}</Btn>}
  </div>
);

const Content = ({ children, top = 172 }) => (
  <div className="absolute" style={{ left: 24, right: 24, top, bottom: 108 }}>{children}</div>
);

export default function BiletomatWersjaB() {
  const [screen, setScreen] = useState('START');
  const [history, setHistory] = useState([]);
  const [lang, setLang] = useState('PL');
  const [cart, setCart] = useState({});
  const [phone, setPhone] = useState('');
  const [idError, setIdError] = useState(false);
  const [now, setNow] = useState(new Date());
  const t = TRANSLATIONS[lang];


  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState('default');
  const [fontLevel, setFontLevel] = useState(0);
  const [a11yOpen, setA11yOpen] = useState(false);
  C = THEMES[theme]; FS = FONT_SCALES[fontLevel];
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

  const resetToStart = () => { setScreen('START'); setHistory([]); setCart({}); setPhone(''); setIdError(false); };

  const endScenario = (sukces, opis = '') => logger.endScenario({ ekran: screenName(), sukces, opis });
  const startScenario = (sc) => {
    if (!logger.ready()) return;
    if (logger.active()) endScenario(false, 'przerwanie_nowy_scenariusz');
    paidWith.current = '';
    corrections.current = 0;
    setTheme('default'); setFontLevel(0); setA11yOpen(false); setLang('PL');   // każdy scenariusz startuje z ustawieniami domyślnymi
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

  useEffect(() => { document.title = ready ? `${VERSION} | ${logger.fileName()}` : 'Biletomat – wersja B'; }, [ready, epoch]);


  /* WCAG 2.2.1: po bezczynności pojawia się ostrzeżenie z przyciskiem wydłużenia sesji (AOI_dostepnosc) */
  const [warnLeft, setWarnLeft] = useState(null);
  const warnRef = useRef(null);
  warnRef.current = warnLeft;
  const lastActive = useRef(Date.now());
  useEffect(() => {
    const touch = () => { if (warnRef.current === null) lastActive.current = Date.now(); };
    window.addEventListener('pointerdown', touch, true);
    return () => window.removeEventListener('pointerdown', touch, true);
  }, []);
  useEffect(() => { lastActive.current = Date.now(); setWarnLeft(null); setIdError(false); }, [screen]);
  useEffect(() => {
    const id = setInterval(() => {
      const sc = screenRef.current;
      if (!ready || sc === 'START' || sc === 'DRUK' || sc === 'KONIEC') { if (warnRef.current !== null) setWarnLeft(null); return; }
      const left = Math.ceil(IDLE_TIMEOUT_S - (Date.now() - lastActive.current) / 1000);
      if (left <= 0) {
        if (logger.active()) logger.emit('blad', { ekran: screenName(), element: 'LIMIT_CZASU', etykieta: 'Upłynął limit bezczynności' });
        setWarnLeft(null); resetToStart();
      } else if (left <= WARN_BEFORE_S) setWarnLeft(left);
      else if (warnRef.current !== null) setWarnLeft(null);
    }, 500);
    return () => clearInterval(id);
  }, [ready]);
  const extendSession = () => { lastActive.current = Date.now(); setWarnLeft(null); };


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
    setIdError(false);   // komunikat znika po następnej zmianie numeru
  };

  /* numer zaczynający się od 0 (np. 000000000) jest nieprawidłowy: komunikat zamiast ukrytego błędu z wersji A (WCAG 3.3.1, 3.3.3) */
  const submitId = () => {
    if (/^0/.test(phone)) {
      setIdError(true);
      if (logger.ready()) logger.emit('blad', { ekran: screenName(), element: 'NUMER_NIEPRAWIDLOWY', etykieta: t.idError });
    } else go('OKRESOWE_KONTO');
  };

  const accountIdDisplay = () => phone.replace(/(\d{3})(?=\d)/g, '$1 ');


  useEffect(() => {
    if (screen === 'DRUK') { const id = setTimeout(() => setScreen('KONIEC'), AUTO_PRINT_MS); return () => clearTimeout(id); }
    if (screen === 'KONIEC') { const id = setTimeout(resetToStart, AUTO_END_MS); return () => clearTimeout(id); }
  }, [screen]);

  const dateText = formatDate(now);
  const nameOf = (tk, discount) => `${t[tk.key]}, ${discount ? t.discountWord : t.normalWord}`;

  /* wskaźnik postępu: kolejność kroków dla ścieżki biletów czasowych (6) i okresowych (3) */
  const STEP = {
    MENU: [1, 0, t.sService], CZASOWE: [2, 6, t.sKind], CZASOWE_NORM: [3, 6, t.sTickets], CZASOWE_ULG: [3, 6, t.sTickets],
    PODSUMOWANIE: [4, 6, t.sSummary], PLATNOSC_WYB: [5, 6, t.sPayment], PLATNOSC: [5, 6, t.sPayment],
    DRUK: [6, 6, t.sPickup], KONIEC: [6, 6, t.sPickup], OKRESOWE: [2, 3, t.sId], OKRESOWE_KONTO: [3, 3, t.sAccount],
  };

  const frame = (children, { back = goBack, cancel = resetToStart, primary = null } = {}) => {
    const [s, n, label] = STEP[screen];
    return (
      <>
        <Header dateText={dateText}><Flags lang={lang} setLang={setLang} /></Header>
        <Progress step={s} total={n} label={label} t={t} />
        <Content>{children}</Content>
        <NavBar back={back} cancel={cancel} primary={primary} onA11y={() => setA11yOpen(true)} t={t} />
      </>
    );
  };

  const ticketList = (kind) => {
    const discount = kind === 'discount';
    return (
      <>
        <div className="flex items-end justify-between" style={{ height: 46, marginBottom: 8, color: C.text }}>
          <div style={{ fontSize: fz(28), fontWeight: 700 }}>{discount ? t.listDiscount : t.listNormal}, {lang === 'DE' ? t.zone : t.zone.toLowerCase()}</div>
          <div style={{ fontSize: fz(26), fontWeight: 700 }}>{t.total}: {formatPrice(total)}</div>
        </div>
        {TICKETS.map((tk) => {
          const price = discount ? tk.discount : tk.normal;
          const key = `${kind}_${tk.id}`;
          return (
            <div key={key} className="flex items-center" style={{ height: 70, marginBottom: 6 }}>
              <div className="flex-1 flex items-center" style={{ height: 66, gap: 14, padding: '0 16px', background: C.btn, border: `2px solid ${C.btnBorder}`, borderRadius: 6, color: C.text }}>
                <Clock size={32} aria-hidden="true" />
                <span style={{ fontSize: fz(26), fontWeight: 700 }}>{nameOf(tk, discount)}</span>
              </div>
              <div style={{ minWidth: Math.round(130 * Math.min(FS, 1.4)), whiteSpace: 'nowrap', textAlign: 'right', fontSize: fz(26), fontWeight: 700, color: C.text, paddingRight: 16 }}>{formatPrice(price)}</div>
              <Btn id={`minus_${key}`} w={64} h={64} label={t.minusLabel} disabled={qty(key) === 0} icon={<Minus size={32} />} onClick={() => updateCart(key, nameOf(tk, discount), price, -1)} />
              <div style={{ width: 60, textAlign: 'center', fontSize: fz(32), fontWeight: 700, color: C.text }}>{qty(key)}</div>
              <Btn id={`plus_${key}`} w={64} h={64} label={t.plusLabel} icon={<Plus size={32} />} onClick={() => updateCart(key, nameOf(tk, discount), price, 1)} />
            </div>
          );
        })}
      </>
    );
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
  const idOk = phone.length >= MIN_ID_LENGTH;
  const nextBtn = (disabled) => ({ id: 'btn_next', label: t.btnNext, disabled, icon: <ArrowRight size={30} />, onClick: () => go('PODSUMOWANIE') });

  return (
    <div className="w-screen h-screen flex items-center justify-center" style={{ background: '#bdbdbd', fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <div style={{ width: 1024 * SCALE, height: 768 * SCALE }}>
        <div
          ref={rootRef}
          className="relative overflow-hidden select-none"
          style={{ width: 1024, height: 768, background: C.bg, color: C.text, transform: `scale(${SCALE})`, transformOrigin: 'top left', border: '2px solid #777', boxSizing: 'border-box' }}
        >
          {C.pattern && <Background />}

          {screen === 'START' && (
            <div data-id="start" data-label="Rozpocznij" className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: 90, cursor: 'pointer' }}
              onClick={() => go('MENU')}>
              {assetOk('startLogo') ? (
                <div style={{ alignSelf: 'flex-start', background: C.plate, padding: C.plate === 'transparent' ? 0 : 14, borderRadius: 8 }}>
                  <AssetImg k="startLogo" style={{ width: 360 }} fallback={null} />
                </div>
              ) : (
                <div className="flex items-end" style={{ gap: 16 }}>
                  <NeutralMark size={150} />
                  <div>
                    <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: 8, color: '#2f2f2f', lineHeight: 1 }}>CITY TICKET</div>
                    <div style={{ fontSize: fz(26), letterSpacing: 6, color: '#222', marginTop: 8 }}>KOMUNIKACJA MIEJSKA</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: fz(30), fontWeight: 700, color: C.text, marginTop: 40, marginLeft: 6 }}>{t.start}</div>
              <div className="flex" style={{ marginTop: 22, gap: 8 }} onClick={(e) => e.stopPropagation()}>
                <Flags lang={lang} setLang={setLang} />
              </div>
              <div className="absolute" style={{ left: 24, bottom: 20 }}>
                <Btn id="a11y_open" w={190} icon={<Accessibility size={30} />} onClick={(e) => { e.stopPropagation(); setA11yOpen(true); }}>{t.a11yBtn}</Btn>
              </div>
            </div>
          )}

          {screen === 'MENU' && frame(
            <>
              <BigChoice id="menu_czasowe" icon={<Clock size={52} />} title={t.menuTime} note={t.menuTimeNote} onClick={() => go('CZASOWE')} />
              <BigChoice id="menu_okresowe" icon={<CalendarDays size={52} />} title={t.menuSeason} note={t.menuSeasonNote} onClick={() => go('OKRESOWE')} />
              <BigChoice id="menu_inna" icon={<Ticket size={52} />} title={t.menuOther} note={t.menuOtherNote} disabled />
            </>
          )}

          {screen === 'CZASOWE' && frame(
            <>
              <BigChoice id="type_normal" icon={<User size={52} />} title={t.typeNormal} note={t.typeNormalNote} onClick={() => go('CZASOWE_NORM')} />
              <BigChoice id="type_discount" icon={<Percent size={52} />} title={t.typeDiscount} note={t.typeDiscountNote} onClick={() => go('CZASOWE_ULG')} />
            </>
          )}

          {screen === 'CZASOWE_NORM' && frame(ticketList('normal'), { primary: nextBtn(cartItems.length === 0) })}
          {screen === 'CZASOWE_ULG' && frame(ticketList('discount'), { primary: nextBtn(cartItems.length === 0) })}

          {screen === 'PODSUMOWANIE' && frame(
            <div style={{ background: C.btn, border: `2px solid ${C.btnBorder}`, borderRadius: 6, padding: '10px 22px', color: C.text, lineHeight: 1.2 }}>
              <div style={{ fontSize: fz(32, 1.2), fontWeight: 700 }}>{t.summaryTitle}</div>
              <div style={{ fontSize: fz(22, 1.2), marginBottom: 6 }}>{t.zone}</div>
              {cartItems.map((it, i) => (
                <div key={i} className="flex justify-between" style={{ fontSize: fz(28, 1.2), padding: cartItems.length > 3 ? '3px 0' : '6px 0', borderTop: `1px solid ${C.line}` }}>
                  <span>{it.qty} × {it.name}</span><span style={{ fontWeight: 700 }}>{formatPrice(it.qty * it.price)}</span>
                </div>
              ))}
              <div className="flex justify-between" style={{ fontSize: fz(40, 1.2), fontWeight: 700, padding: '8px 0 2px', borderTop: `3px solid ${C.line}`, marginTop: 6 }}>
                <span>{t.total}</span><span>{formatPrice(total)}</span>
              </div>
              <div style={{ fontSize: fz(22, 1.2), marginTop: 6 }}>{t.summaryHint}</div>
            </div>,
            { primary: { id: 'btn_pay', label: t.btnPay, icon: <Check size={30} />, onClick: () => go('PLATNOSC_WYB') } }
          )}

          {screen === 'PLATNOSC_WYB' && frame(
            <>
              <div style={{ fontSize: fz(34), fontWeight: 700, marginBottom: 6 }}>{t.payTitle}</div>
              <div style={{ fontSize: fz(28), marginBottom: 20 }}>{t.payTotal}: <b>{formatPrice(total)}</b></div>
              <BigChoice id="pay_card" icon={<CreditCard size={52} />} title={t.payCard} onClick={() => go('PLATNOSC')} />
              <BigChoice id="pay_cash" icon={<Banknote size={52} />} title={t.payCash} onClick={() => { }} />
            </>
          )}

          {screen === 'PLATNOSC' && frame(
            <div className="flex flex-col items-center" style={{ color: C.text }}>
              <div style={{ fontSize: fz(36) }}>{t.payTotal}: <b>{formatPrice(total)}</b></div>
              <div data-id="sim_card" onClick={() => go('DRUK')}
                style={{ marginTop: 24, width: 260, height: 170, background: '#202020', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 6 }}>
                <Wifi size={70} style={{ transform: 'rotate(90deg)' }} />
                <div style={{ marginTop: 10, background: '#2a56a8', fontSize: fz(16), padding: '2px 16px', fontWeight: 700 }}>PAY</div>
              </div>
              <div style={{ marginTop: 20, fontSize: fz(28), fontWeight: 700, textAlign: 'center' }}>{t.payInst}</div>
              <div style={{ marginTop: 10, fontSize: fz(18) }}>({t.simHint})</div>
            </div>
          )}

          {screen === 'DRUK' && (
            <>
              <Header dateText={dateText}></Header>
              <Progress step={6} total={6} label={t.sPickup} t={t} />
              <Content>
                <div className="flex flex-col items-center" style={{ marginTop: 50, color: C.text }}>
                  <Loader2 size={130} className="animate-spin" style={{ color: C.text }} />
                  <div style={{ marginTop: 28, fontSize: fz(30), fontWeight: 700 }}>{t.printWait}</div>
                </div>
              </Content>
            </>
          )}

          {screen === 'KONIEC' && frame(
            <div className="flex flex-col items-center" style={{ color: C.text }}>
              <Smile size={170} strokeWidth={1.6} />
              <div style={{ marginTop: 14, fontSize: fz(32), fontWeight: 700 }}>{t.doneMsg}</div>
              <div style={{ marginTop: 18 }}><Btn id="btn_receipt" w={360} icon={<Printer size={28} />}>{t.doneRec}</Btn></div>
            </div>,
            { back: null, cancel: null, primary: { id: 'btn_end', label: t.btnEnd, icon: <Check size={30} />, onClick: resetToStart } }
          )}

          {screen === 'OKRESOWE' && frame(
            <div className="flex" style={{ gap: 16, height: '100%' }}>
              <div className="flex flex-col" style={{ width: 300, gap: 12 }}>
                <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ background: C.btn, border: `2px solid ${C.btnBorder}`, borderRadius: 6, padding: 16, fontSize: fz(24), fontWeight: 700, gap: 12, color: C.text }}>
                  <CreditCard size={56} />{t.tileCard}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ background: C.btn, border: `2px solid ${C.btnBorder}`, borderRadius: 6, padding: 16, fontSize: fz(24), fontWeight: 700, gap: 12, color: C.text }}>
                  <QrCode size={56} />{t.tileQr}
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center" style={{ background: C.btn, border: `2px solid ${C.btnBorder}`, borderRadius: 6, padding: '10px 14px', color: C.text }}>
                {idError
                  ? <div data-id="komunikat_bledu" data-label="Komunikat o błędzie numeru" role="alert" style={{ fontSize: fz(20, 1.2), fontWeight: 700, textAlign: 'center', minHeight: 52, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `3px solid ${C.btnBorder}`, borderRadius: 4, padding: '0 8px' }}><AlertTriangle size={28} aria-hidden="true" />{t.idError}</div>
                  : <div style={{ fontSize: fz(20, 1.2), textAlign: 'center', minHeight: 52 }}>{t.seasonDesc}</div>}
                <div data-id="field_number" data-label="Pole numeru" style={{ width: 360, height: FS > 1.2 ? 56 : 60, background: C.btn, border: `3px solid ${C.btnBorder}`, fontSize: fz(32), fontWeight: 700, display: 'flex', alignItems: 'center', padding: '0 12px', letterSpacing: 2 }}>
                  +48 {phone}
                </div>
                <div className="grid" style={{ marginTop: 10, gridTemplateColumns: 'repeat(3, 112px)', gap: 10 }}>
                  {keypad.map((k) => {
                    if (k === 'ok') return <Btn key="ok" id="key_ok" w={112} h={FS > 1.2 ? 56 : 64} size={26} primary={idOk} disabled={!idOk} onClick={submitId}>OK</Btn>;
                    if (k === 'back') return <Btn key="back" id="key_back" w={112} h={FS > 1.2 ? 56 : 64} label={t.delLabel} icon={<Delete size={34} />} onClick={() => pressKey('back')} />;
                    return <Btn key={k} id={`key_${k}`} w={112} h={FS > 1.2 ? 56 : 64} size={32} onClick={() => pressKey(k)}>{k}</Btn>;
                  })}
                </div>
                <div style={{ marginTop: 8, fontSize: fz(18, 1.2), minHeight: 22 }}>{!idOk ? t.seasonOkHint.replace('{n}', String(MIN_ID_LENGTH)) : ''}</div>
              </div>
            </div>
          )}

          {screen === 'OKRESOWE_KONTO' && frame(
            <div className="flex" style={{ gap: 20 }}>
              <div className="flex-1" style={{ color: C.text }}>
                <div style={{ fontSize: fz(28), fontWeight: 700, borderBottom: `2px solid ${C.line}`, paddingBottom: 8 }}>
                  {t.seasonId}: {accountIdDisplay()}
                </div>
                <div style={{ marginTop: 10, fontSize: fz(20), border: `2px solid ${C.line}`, padding: '4px 10px', background: C.btn }}>{t.wallet}</div>
                <div className="flex items-center justify-center" style={{ height: 170, fontSize: fz(30), border: `2px solid ${C.line}`, borderTop: 0, background: C.btn }}>
                  {t.seasonFunds}: <b style={{ marginLeft: 10 }}>0,00 zł</b>
                </div>
                <div style={{ fontSize: fz(18), padding: '6px 10px', border: `2px solid ${C.line}`, borderTop: 0, background: C.btn }}>{t.seasonFooter}</div>
              </div>
              <div className="flex flex-col" style={{ width: 300, gap: 14 }}>
                <Btn id="btn_topup" w={300} h={84} size={26} primary onClick={() => { }}>{t.seasonTopup}</Btn>
                <Btn id="btn_buy" w={300} h={84} size={26} onClick={() => { }}>{t.seasonBuy}</Btn>
              </div>
            </div>
          )}

          {a11yOpen && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 15 }} role="dialog" aria-label={t.a11yTitle}>
              <div style={{ width: 900, background: C.btn, border: `4px solid ${C.line}`, borderRadius: 8, padding: '18px 28px', color: C.text }}>
                <div style={{ fontSize: fz(32), fontWeight: 700 }}>{t.a11yTitle}</div>
                <div style={{ fontSize: fz(22), fontWeight: 700, marginTop: 12 }}>{t.a11yContrast}</div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }}>
                  {[['default', t.themeDefault], ['wb', t.themeWb], ['yb', t.themeYb], ['by', t.themeBy]].map(([k, label]) => (
                    <Btn key={k} id={`contrast_${k}`} full h={72} size={22} selected={theme === k} onClick={() => setTheme(k)}
                      icon={<span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 34, background: THEMES[k].bg, color: THEMES[k].text, border: `3px solid ${THEMES[k].line}`, borderRadius: 4, fontSize: fz(18), fontWeight: 700 }}>Aa</span>}>
                      {label}
                    </Btn>
                  ))}
                </div>
                <div style={{ fontSize: fz(22), fontWeight: 700, marginTop: 14 }}>{t.a11yFont}</div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                  {[t.fontNormal, t.fontLarge, t.fontXL].map((label, i) => (
                    <Btn key={i} id={`font_${i}`} full h={72} size={20 + i * 3} selected={fontLevel === i} onClick={() => setFontLevel(i)}>{label}</Btn>
                  ))}
                </div>
                <div className="flex justify-end" style={{ marginTop: 16 }}>
                  <Btn id="a11y_close" w={220} primary icon={<Check size={30} />} onClick={() => setA11yOpen(false)}>{t.a11yClose}</Btn>
                </div>
              </div>
            </div>
          )}

          {warnLeft !== null && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 20 }} role="alertdialog" aria-live="assertive">
              <div style={{ width: 620, background: C.btn, border: `4px solid ${C.line}`, borderRadius: 8, padding: 30, color: C.text, textAlign: 'center' }}>
                <AlertTriangle size={64} style={{ margin: '0 auto' }} />
                <div style={{ fontSize: fz(34), fontWeight: 700, marginTop: 10 }}>{t.toTitle}</div>
                <div style={{ fontSize: fz(28), marginTop: 10 }}>{t.toBody.replace('{n}', String(warnLeft))}</div>
                <div className="flex flex-col items-center" style={{ gap: 14, marginTop: 24 }}>
                  <Btn id="extend" aoi="AOI_dostepnosc" w={420} h={84} size={28} primary onClick={extendSession}>{t.toExtend}</Btn>
                  <Btn id="timeout_end" w={420} h={64} size={24} onClick={() => { setWarnLeft(null); resetToStart(); }}>{t.toEnd}</Btn>
                </div>
              </div>
            </div>
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
