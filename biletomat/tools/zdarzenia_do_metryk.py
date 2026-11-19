#!/usr/bin/env python3
"""Liczy z plików PUN_zdarzenia_*.csv zmienne do PUN_dane_badania (wg słownika zmiennych):
sukces, czas_ms, dotkniecia, dotkniecia_obok, powroty oraz moment pojawienia się AOI_cel
(czas_epoch_ms), od którego liczy się ttff_ms w iMotions.
Każde uruchomienie scenariusza (scenariusz_start) to osobna próba (kolumna proba).
Użycie: python3 tools/zdarzenia_do_metryk.py PUN_zdarzenia_I04_P01_A.csv [kolejne pliki] > metryki.csv"""
import csv, sys

OUT = ['interfejs', 'uczestnik', 'data_sesji', 'kolejnosc', 'wersja', 'scenariusz', 'proba', 'sukces', 'czas_ms',
       'dotkniecia', 'dotkniecia_obok', 'powroty', 'aoi_cel_pojawil_sie_epoch_ms']

def metrics(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f, delimiter=';'))
    sesja = next((r for r in rows if r['zdarzenie'] == 'sesja'), None)
    data = sesja['czas_lokalny'][:10] if sesja else ''
    res = {}
    run = {}   # numer próby danego scenariusza (każde scenariusz_start zaczyna nową próbę)
    for r in rows:
        s = r['scenariusz']
        if not s:
            continue
        if r['zdarzenie'] == 'scenariusz_start':
            run[s] = run.get(s, 0) + 1
        m = res.setdefault((s, run.get(s, 1)), dict(proba=run.get(s, 1), interfejs=r['interfejs'], uczestnik=r['uczestnik'], data_sesji=data,
                                   kolejnosc=r['kolejnosc'], wersja=r['wersja'], scenariusz=s, sukces='', czas_ms='',
                                   dotkniecia=0, dotkniecia_obok=0, powroty=0, aoi_cel_pojawil_sie_epoch_ms=''))
        z = r['zdarzenie']
        if z == 'dotkniecie':
            m['dotkniecia'] += 1
            if r['trafienie'] == '0': m['dotkniecia_obok'] += 1
            if r['element'] == 'wstecz' and r['trafienie'] == '1': m['powroty'] += 1
        elif z == 'aoi' and r['aoi'] == 'AOI_cel' and m['aoi_cel_pojawil_sie_epoch_ms'] == '':
            m['aoi_cel_pojawil_sie_epoch_ms'] = r['czas_epoch_ms']
        elif z == 'scenariusz_koniec':
            m['sukces'] = r['sukces']; m['czas_ms'] = r['czas_ms']
    return list(res.values())

if __name__ == '__main__':
    w = csv.DictWriter(sys.stdout, fieldnames=OUT, delimiter=';', lineterminator='\n')
    w.writeheader()
    for p in sys.argv[1:]:
        for m in metrics(p): w.writerow(m)
