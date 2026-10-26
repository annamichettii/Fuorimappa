#!/usr/bin/env python3
"""Notifiche Fuori Mappa: nuovi link nel catalogo, non modifiche a pagine esistenti.

- Push: confronta gli <a class="journey-card"> fra il vecchio e nuovo itinerari.html.
- Avvisa solo se esiste il file .html locale e la pagina e' disponibile sul sito.
- workflow_dispatch: invia sempre un test solo a FM_TEST_SUBSCRIPTION_ID.
- FM_PUSH_MODE: off (default), test, all. Nessuna chiave nel repository.
"""
import json
import hashlib
import os
import re
import subprocess
import sys
import time
import uuid
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

APP_ID = '08f8793c-9b02-4986-a8a1-f71234c02513'
SITE = 'https://www.fuorimappa.it/'
REPO = Path.cwd()
CATALOGUE = REPO / 'itinerari.html'
SIMPLE_FILE = re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_-]*\.html\Z')
UUID_VALUE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\Z', re.I)


class Cards(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.current = None
        self.in_title = False
        self.cards = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and 'journey-card' in a.get('class', '').split():
            self.current = {'href': a.get('href', ''), 'title': []}
        elif self.current is not None and tag == 'h3':
            self.in_title = True

    def handle_data(self, data):
        if self.current is not None and self.in_title:
            self.current['title'].append(data)

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_title = False
        elif tag == 'a' and self.current is not None:
            href = self.current['href'].strip()
            if SIMPLE_FILE.fullmatch(href):
                title = ' '.join(' '.join(self.current['title']).split())
                if title:
                    self.cards[href] = title
            self.current = None
            self.in_title = False


def parse_cards(markup):
    parser = Cards()
    parser.feed(markup)
    return parser.cards


def previous_catalogue(before_sha):
    if not re.fullmatch(r'[0-9a-f]{40}', before_sha, re.I) or before_sha == '0' * 40:
        print('Nessuna revisione precedente: niente notifiche durante la prima configurazione.')
        return None
    p = subprocess.run(['git', 'show', f'{before_sha}:itinerari.html'],
                       capture_output=True, text=True, check=False)
    if p.returncode != 0:
        print('Non riesco a leggere il catalogo precedente: salto per evitare invii errati.')
        return None
    return parse_cards(p.stdout)


def wait_until_live(filename, attempts=16, delay=15):
    url = urljoin(SITE, filename)
    for n in range(attempts):
        try:
            request = Request(url, headers={'User-Agent': 'FuoriMappa-PublicationCheck/1.0'})
            with urlopen(request, timeout=15) as response:
                if (response.status == 200 and
                    response.geturl().startswith(SITE) and
                    'text/html' in response.headers.get('Content-Type', '').lower() and
                    b'<html' in response.read(2048).lower()):
                    return url
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            if n == 0 or n == attempts - 1:
                print(f'Pagina non ancora disponibile ({type(exc).__name__}); tentativo {n+1}/{attempts}')
        if n < attempts - 1:
            time.sleep(delay)
    return None


def push(title, filename, target, key, message_kind):
    url = wait_until_live(filename)
    if url is None:
        raise RuntimeError(f'{filename} non risulta pubblicato: non invio la notifica.')

    title = title[:90]
    push_title = f'🌍 Nuovo itinerario: {title}' if message_kind != 'manual' else '🔔 Prova notifiche Fuori Mappa'
    body = (f'Scopri {title} su Fuori Mappa. Tocca per esplorare il viaggio! ✈️'
            if message_kind != 'manual' else
            f'Funziona! Tocca per aprire l’itinerario {title}. 🌍')
    dedup_ref = f'{APP_ID}|{filename}|{message_kind}|{target}|{os.getenv("GH_SHA", "")}|{os.getenv("GH_RUN_ID", "") if message_kind == "manual" else ""}'
    raw_key = bytearray(hashlib.sha256(dedup_ref.encode('utf-8')).digest()[:16])
    raw_key[6] = (raw_key[6] & 0x0F) | 0x40  # UUID versione 4, stabile per i retry
    raw_key[8] = (raw_key[8] & 0x3F) | 0x80
    idempotency = str(uuid.UUID(bytes=bytes(raw_key)))
    payload = {
        'app_id': APP_ID,
        'target_channel': 'push',
        'headings': {'en': push_title, 'it': push_title},
        'contents': {'en': body, 'it': body},
        'url': url,
        'name': f'Fuori Mappa | {message_kind} | {title}',
        'idempotency_key': idempotency,
    }
    if target == 'all':
        payload['included_segments'] = ['Subscribed Users']
    else:
        target_id = os.getenv('FM_TEST_SUBSCRIPTION_ID', '').strip()
        if not UUID_VALUE.fullmatch(target_id):
            raise RuntimeError('Manca FM_TEST_SUBSCRIPTION_ID valido nelle Variables di GitHub.')
        payload['include_subscription_ids'] = [target_id]

    print(f'Invio {message_kind} per: {title} -> {url} | destinatari: {target}')
    req = Request('https://api.onesignal.com/notifications',
                  data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                  headers={'Content-Type': 'application/json; charset=utf-8',
                           'Authorization': f'Key {key}', 'Accept': 'application/json'},
                  method='POST')
    try:
        with urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
    except HTTPError as exc:
        response_text = exc.read(700).decode('utf-8', errors='replace')
        raise RuntimeError(f'OneSignal ha risposto HTTP {exc.code}: {response_text}') from None
    if not result.get('id'):
        raise RuntimeError(f'OneSignal non ha creato una notifica: {result}')
    print(f'Notifica accettata da OneSignal! ID: {result["id"]}')


def main():
    event = os.getenv('GH_EVENT_NAME', '')
    manual = event == 'workflow_dispatch'
    mode = 'test' if manual else (os.getenv('FM_PUSH_MODE', 'off').strip().lower() or 'off')
    if mode not in {'off', 'test', 'all'}:
        raise RuntimeError('FM_PUSH_MODE deve essere off, test o all.')
    if mode == 'off':
        print('Automazione disattivata: imposta FM_PUSH_MODE a test o all quando sei pronta.')
        return

    if manual:
        filename = os.getenv('FM_MANUAL_PATH', '').strip()
        if not SIMPLE_FILE.fullmatch(filename):
            raise RuntimeError('Per il test inserisci un nome semplice, es. thailandia.html.')
        title = parse_cards(CATALOGUE.read_text(encoding='utf-8')).get(filename)
        if not title:
            raise RuntimeError(f'{filename} non e presente nelle cartoline di itinerari.html.')
        news = [(filename, title)]
    else:
        old_cards = previous_catalogue(os.getenv('GH_BEFORE_SHA', ''))
        if old_cards is None:
            return
        current = parse_cards(CATALOGUE.read_text(encoding='utf-8'))
        news = [(f, title) for f, title in current.items() if f not in old_cards]
        print('Nuove cartoline rilevate:', len(news))
        if not news:
            print('Aggiornamento del sito o di un itinerario esistente: nessuna notifica.')
            return
        if len(news) > 3:
            raise RuntimeError('Più di tre nuove cartoline insieme: invio bloccato per sicurezza.')

    for filename, title in news:
        if not (REPO / filename).is_file():
            raise RuntimeError(f'{filename} non e nel repository. Aggiungi prima il file HTML.')
    key = os.getenv('ONESIGNAL_REST_API_KEY', '').strip()
    if not key:
        raise RuntimeError('Manca il secret ONESIGNAL_REST_API_KEY. Non inserirlo nei file pubblici.')
    for filename, title in news:
        push(title, filename, 'test' if manual else mode, key, 'manual' if manual else 'nuovo-itinerario')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERRORE: {e}', file=sys.stderr)
        sys.exit(1)
