# Louis Culot · B2B-landingspagina (b2b.culot.be)

Statische pagina op **GitHub Pages**. Leads gaan van het formulier naar een **Google Apps Script**, dat ze in een **Google Sheet** zet, de geüploade plannen in **Google Drive** bewaart en daarna **Make** aanroept. Make stuurt de mail (voorlopig naar davy@pro-active.be).

```
Formulier (b2b.culot.be)
   └─► Apps Script Web App ──► Google Sheet "Leads"  (+ plannen in Drive-map)
                          └──► Make-webhook ──► e-mail naar Pro Active / later Culot
                          └──► (fallback) rechtstreekse mail als Make niet reageert
```

## Structuur

| Pad | Wat |
|---|---|
| `index.html` | De pagina. Alle instellingen staan bovenaan in `window.LC_CONFIG`. |
| `assets/` | Beelden (webp + jpg-fallback), favicon, OG-beeld |
| `CNAME` | Het custom domein voor GitHub Pages (`b2b.culot.be`) |
| `robots.txt` | Staat voorlopig op *disallow*. Aanpassen bij lancering. |
| `404.html` | Foutpagina |
| `apps-script/Code.gs` | Backend. Hoort **niet** online; dit is enkel de broncode die je in Apps Script plakt. |

> Wijzig je het subdomein, pas dan `CNAME`, de canonical en de OG-tags in `index.html`, de DNS-aanvraag hieronder en de mailtekst in Make aan.

---

## Stap 1 — Google Sheet + Apps Script (± 10 min)

1. Maak een nieuwe Google Sheet: **"Louis Culot – B2B-leads"**.
2. Maak een Drive-map **"Louis Culot – B2B-plannen"** en kopieer de map-ID uit de URL (het deel na `/folders/`).
3. Open in de Sheet **Extensies → Apps Script**, verwijder de standaardcode en plak de inhoud van `apps-script/Code.gs`.
4. Ga naar **Projectinstellingen → Scripteigenschappen** en voeg toe:
   - `DRIVE_FOLDER_ID` = de map-ID uit stap 2
   - `ALERT_EMAIL` = `davy@pro-active.be`
   - `MAKE_WEBHOOK_URL` = de webhook-URL uit stap 2b (kan later)
5. Selecteer de functie `setup` en klik **Uitvoeren**. Keur de gevraagde rechten goed (Sheets, Drive, Mail, externe requests). Dit maakt het tabblad `Leads` aan met headers.
6. Klik **Implementeren → Nieuwe implementatie → Type: Web-app**:
   - Uitvoeren als: **Ik**
   - Wie heeft toegang: **Iedereen**
7. Kopieer de URL (eindigt op `/exec`) en plak die in `index.html` bij `FORM_ENDPOINT`.

**Let op:** wijzig je later de code, kies dan *Implementaties beheren → Bewerken → Nieuwe versie*. Anders blijft de oude versie draaien en verandert de URL.

## Stap 2 — Make-scenario

**2a.** Nieuw scenario → module **Webhooks → Custom webhook** → *Add* → kopieer de URL.

**2b.** Zet die URL in Apps Script als `MAKE_WEBHOOK_URL`. Verstuur daarna één testlead via de pagina, zodat Make de datastructuur leert ("Redetermine data structure").

**2c.** Voeg de module **E-mail versturen** toe (Gmail of Microsoft 365 — kies de mailbox van waaruit Pro Active verstuurt):

- **Aan:** `davy@pro-active.be` (later: het adres van Culot, zie open punten)
- **Reply-to:** `{{mail}}`, zodat Culot rechtstreeks de lead kan beantwoorden
- **Onderwerp:** `[B2B-lead] {{lead_type}} – {{bedrijf}} ({{type}})`
- **Inhoud** (HTML):

```
Nieuwe B2B-aanvraag via b2b.culot.be — {{lead_id}}

Type:        {{lead_type}}
Bedrijf:     {{bedrijf}} · {{type}}
Contact:     {{naam}} · {{tel}} · {{mail}}
Postcode:    {{postcode}}
Plaatsing:   {{timing}}
Materiaal:   {{materiaal}}
Kennismaken: {{kennismaking}}
Bericht:     {{bericht}}
Plannen:     {{join(plannen; ", ")}}

Bron: {{attributie.utm_source}} / {{attributie.utm_medium}} / {{attributie.utm_campaign}} · gclid: {{attributie.gclid}}
```

**2d.** Voeg als laatste module **Webhooks → Webhook response** toe: status `200`, body `ok`. Make antwoordt anders altijd "Accepted", ook als het scenario uit staat of de mail faalt. Apps Script telt enkel `ok` als verstuurd; al de rest triggert de fallbackmail.

**2e.** Zet het scenario op **Immediately** (webhook) en activeer het.

> Gebouwd op 28/09/2026: scenario "Culot B2B – leads b2b.culot.be → mail" (Make, team My Team), webhook "Culot B2B – leads", verstuurt via de Gmail-connectie van davy@pro-active.be.

Waarom niet "Google Sheets → Watch new rows"? Die module pollt. Op een lager Make-plan betekent dat pas na 15 minuten een mail. De webhook is direct, en de Sheet blijft de bron van waarheid. Mislukt de webhook, dan zet Apps Script `NEE – fallback mail` in de kolom *Make verstuurd* en mailt het rechtstreeks naar `ALERT_EMAIL`. Er gaat dus geen lead verloren.

## Stap 3 — GitHub Pages

1. Push deze repo (inhoud van deze map in de root).
2. **Settings → Pages → Source:** *Deploy from a branch* → `main` / `/ (root)`.
3. **Custom domain:** `b2b.culot.be` (wordt ook uit het `CNAME`-bestand gelezen).
4. **Aangeraden — domein verifiëren**, zodat niemand anders het subdomein kan claimen: *Profiel/Organisatie → Settings → Pages → Add a domain* → `b2b.culot.be`. GitHub toont dan een TXT-record: neem dat mee in de DNS-aanvraag.
5. Zodra de DNS actief is: vink **Enforce HTTPS** aan. Het certificaat wordt automatisch aangemaakt, wat tot 24u kan duren.

## Stap 4 — DNS-aanvraag voor Crossmark (klaar om te versturen)

Vul `<GITHUB-USER>` in: de gebruikers- of organisatienaam waaronder de repo staat, in kleine letters. De verificatiecode krijg je uit stap 3.4.

> **Onderwerp:** DNS-records voor subdomein b2b.culot.be
>
> Hallo,
>
> In opdracht van Louis Culot lanceren we een aparte landingspagina voor professionals op **b2b.culot.be**. De pagina wordt door Pro Active gehost; aan de huidige website en de mailconfiguratie verandert niets.
>
> Kunnen jullie in de DNS-zone van culot.be de volgende records toevoegen?
>
> | Type | Naam / host | Waarde | TTL |
> |---|---|---|---|
> | CNAME | `b2b` | `<GITHUB-USER>.github.io.` | 3600 |
> | TXT | `_github-pages-challenge-<GITHUB-USER>.b2b` | `<VERIFICATIECODE>` | 3600 |
>
> Het TXT-record dient enkel om het domein bij GitHub te verifiëren.
>
> Voor alle duidelijkheid: de bestaande A-, MX- en TXT-records (o.a. SPF voor Microsoft 365) blijven ongewijzigd, en er komt geen record op het hoofddomein culot.be of op www.
>
> Laat gerust iets weten zodra het actief is, dan zetten we HTTPS aan.
>
> Alvast bedankt!

**Voor je verstuurt:** de nameservers van culot.be zijn `european-server.eu/.com`, niet die van Crossmark. Check bij Tim C. of Crossmark wie de DNS-zone beheert. Kan niemand dit bij Crossmark doen, dan ligt het bij de registrar of hostingpartij waar Culot zelf een account heeft.

## Stap 5 — Tracking (vóór de campagne start)

In `index.html` → `LC_CONFIG`:

- `GA4_ID`: dezelfde GA4-property als culot.be, zodat bezoekers die doorklikken dezelfde gebruiker blijven. Voeg `culot.be` en `b2b.culot.be` toe bij *Admin → Data streams → Configure tag settings → Configure your domains*.
- `ADS_ID` + twee conversielabels: maak in Google Ads (account 164-083-7244) twee conversie-acties aan: **B2B – offerteaanvraag** (primair) en **B2B – kennismaking** (secundair of primair, naargelang de biedstrategie). **Houd ze apart van de B2C-conversies**, anders vervuilen ze de CPA-sturing van de bestaande campagnes.

Events die de pagina stuurt (enkel na cookie-toestemming): `cta_click`, `segment_select`, `form_start`, `generate_lead` (met `lead_type`, `bedrijfstype`, `segment`).

**Consent:** de pagina laadt géén Google-tags vóór toestemming (*basic mode*). Dat is de veiligste keuze in België, maar je verliest de conversies van bezoekers die weigeren. Wil je *advanced* Consent Mode (cookieloze pings, gemodelleerde conversies), dan is dat een bewuste keuze die Culot moet goedkeuren. De gclid wordt **altijd** mee opgeslagen in de Sheet. Zo kun je leads later via *offline conversion import* alsnog aan campagnes koppelen.

---

## Checklist vóór lancering

- [ ] Alle inhoudelijke claims bevestigd door Tim C.: antwoord binnen 2 werkdagen, vast aanspreekpunt/projectverantwoordelijke, vaste plaatsingsdatum, "uw klant blijft uw klant", partnervoorwaarden, regio, stalenset voor partners
- [ ] Doorlooptijd ingevuld in de FAQ (placeholder staat tussen `[ ]`)
- [ ] Toestemming van elke partner die bij naam genoemd wordt (partnerstrip + testimonials)
- [ ] Ontvangstadres van leads bij Culot bepaald, en aangepast in Make
- [ ] **GDPR:** verwerkersovereenkomst Culot ↔ Pro Active (de leads staan in onze Google-omgeving en gaan via Make); privacyverklaring van culot.be vermeldt het subdomein en de verwerkers (Google, Make); bewaartermijn afgesproken (voorstel: 24 maanden, daarna rijen en Drive-mappen verwijderen)
- [ ] Testlead in beide modi (offerte + kennismaking), met en zonder bijlage → Sheet, Drive en mail gecontroleerd
- [ ] Test op iPhone en Android: formulier, sticky CTA, cookiebanner
- [ ] `robots.txt` → `Allow: /` en `<meta name="robots">` verwijderen in `index.html`
- [ ] Link vanaf culot.be naar b2b.culot.be (footer of menu "Voor professionals"), te vragen aan Crossmark
