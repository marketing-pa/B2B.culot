/**
 * Louis Culot · B2B-leads
 * Formulier (pro.culot.be) → deze Web App → Google Sheet (+ plannen in Drive) → Make-webhook
 *
 * Script properties (Project Settings → Script properties):
 *   DRIVE_FOLDER_ID   ID van de Drive-map voor geüploade plannen
 *   MAKE_WEBHOOK_URL  URL van de "Custom webhook" in Make (optioneel, maar aangeraden)
 *   ALERT_EMAIL       fallback-adres als Make niet bereikbaar is (bv. davy@pro-active.be)
 */

const SHEET_NAME = 'Leads';
const HEADERS = [
  'Lead-ID', 'Ontvangen', 'Type lead', 'Bedrijf', 'Activiteit', 'Naam', 'Telefoon', 'E-mail',
  'Postcode project', 'Gewenste plaatsing', 'Materiaal', 'Kennismaking via', 'Bericht',
  'Plannen (links)', 'Segment-tab', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
  'gclid', 'fbclid', 'Referrer', 'Pagina', 'Invultijd (s)', 'Status', 'Make verstuurd'
];
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents || '{}');

    // Basis-spamfilters: verplichte velden + te snel ingevuld
    const required = ['bedrijf', 'type', 'naam', 'tel', 'mail'];
    if (required.some(k => !String(d[k] || '').trim())) return json({ ok: false, error: 'missing' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.mail)) return json({ ok: false, error: 'email' });
    if (Number(d.invultijd_sec) < 4) return json({ ok: true }); // bot: stil negeren

    const id = 'B2B-' + Utilities.formatDate(new Date(), 'Europe/Brussels', 'yyMMdd-HHmmss') +
               '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const links = saveFiles(d.bestanden || [], id, d.bedrijf);
    const a = d.attributie || {};

    const row = [
      id, new Date(), d.lead_type, d.bedrijf, d.type, d.naam, "'" + d.tel, d.mail,
      d.postcode, d.timing, d.materiaal, d.kennismaking, d.bericht,
      links.join('\n'), d.segment_tab, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term,
      a.gclid, a.fbclid, d.referrer, d.pagina, d.invultijd_sec, 'Nieuw', ''
    ].map(v => v === undefined || v === null ? '' : v);

    lock.waitLock(10000);
    const sh = sheet();
    sh.appendRow(row);
    const rowNr = sh.getLastRow();
    lock.releaseLock();

    const sent = notifyMake(Object.assign({ lead_id: id, rij: rowNr, plannen: links }, d, { bestanden: undefined }));
    sh.getRange(rowNr, HEADERS.indexOf('Make verstuurd') + 1).setValue(sent ? 'ja' : 'NEE – fallback mail');
    if (!sent) fallbackMail(id, d, links);

    return json({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    try { fallbackMail('FOUT', { naam: String(err) }, []); } catch (e2) {}
    return json({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doGet() { return json({ ok: true, service: 'culot-b2b-leads' }); }

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function saveFiles(files, id, bedrijf) {
  const folderId = prop('DRIVE_FOLDER_ID');
  if (!files.length || !folderId) return [];
  let total = 0;
  const parent = DriveApp.getFolderById(folderId);
  const sub = parent.createFolder(id + ' – ' + String(bedrijf).slice(0, 60));
  return files.map(f => {
    const bytes = Utilities.base64Decode(f.data);
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return '(te groot, niet opgeslagen: ' + f.name + ')';
    return sub.createFile(Utilities.newBlob(bytes, f.type, f.name)).getUrl();
  });
}

function notifyMake(payload) {
  const url = prop('MAKE_WEBHOOK_URL');
  if (!url) return false;
  try {
    const r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    // Make antwoordt "Accepted" zodra de webhook data ontvangt, ook als het scenario uit staat of faalt.
    // Het scenario eindigt daarom met een Webhook response "ok": alleen dat telt als verstuurd.
    return r.getResponseCode() === 200 && r.getContentText().trim() === 'ok';
  } catch (e) { return false; }
}

function fallbackMail(id, d, links) {
  const to = prop('ALERT_EMAIL');
  if (!to) return;
  MailApp.sendEmail(to, '[Culot B2B] Nieuwe lead ' + id + ' (Make niet bereikt)',
    ['Bedrijf: ' + (d.bedrijf || ''), 'Naam: ' + (d.naam || ''), 'Tel: ' + (d.tel || ''),
     'Mail: ' + (d.mail || ''), 'Type: ' + (d.lead_type || ''), 'Plannen: ' + links.join(', ')].join('\n'));
}

function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Eenmalig handmatig uitvoeren: maakt tabblad + headers en vraagt de nodige rechten aan. */
function setup() { sheet(); console.log('OK – tabblad "' + SHEET_NAME + '" klaar'); }
