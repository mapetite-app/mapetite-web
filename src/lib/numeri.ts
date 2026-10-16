// Numeri del pannello di Lorenzo (/admin/numeri, PIANO-25-OTTOBRE.md 7.1–7.5): tutto calcolato
// dagli eventi della tabella `events`. Solo funzioni pure e nessun import, così il giro automatico
// le prova anche senza server (Node legge il .ts direttamente).

export type EventRow = {
  created_at: string;
  type: string;
  user_id: string | null;
  anon_id: string | null;
  session_id?: string | null;
  props: Record<string, unknown> | null;
};

export type Conteggio = { chiave: string; volte: number; persone: number };
export type Ritorno = { giorni: number; tornati: number; base: number };
export type Giorno = { giorno: string; attivi: number; sessioni: number; ricerche: number; salvataggi: number };
export type Tester = {
  chi: string; registrato: boolean; prima: string; ultima: string;
  giorniAttivi: number; sessioni: number; ricerche: number; salvati: number; errori: number;
};
export type ErroreRiga = { messaggio: string; pagina: string; volte: number; persone: number; ultima: string };

export type Numeri = {
  giorni: number;
  eventi: number;
  attivi: { totale: number; registrati: number; anonimi: number };
  nuovi: number;
  ritorni: Ritorno[];
  sessioni: { totale: number; perUtente: number | null; durataMediana: number | null };
  ricerche: { totale: number; perUtente: number | null; senzaRisultati: number; ai: number; filtri: number };
  salvataggi: { totale: number; perUtente: number | null };
  imbuto: { passo: string; volte: number; persone: number }[];
  funzioni: Conteggio[];
  errori: ErroreRiga[];
  ricerchePerTipo: Conteggio[];
  ricerchePerZona: Conteggio[];
  requisiti: Conteggio[];
  pagine: Conteggio[];
  utile: { si: number; no: number };
  perGiorno: Giorno[];
  tester: Tester[];
  // Nessun evento dei tipi nuovi: probabilmente la migrazione 20261015 non è ancora applicata.
  senzaTracciamento: boolean;
};

// Funzioni che i tester possono usare: quelle mai toccate compaiono con 0 ("meno usate").
export const FUNZIONI_NOTE = [
  "ricerca_ai", "filtri", "voce", "domanda_successiva", "apri_scheda", "salva", "rimuovi",
  "ci_sono_stato", "voglio_andarci", "percorso", "chiama", "sito", "condividi",
  "condividi_ricerca", "condividi_lista", "sorprendimi",
  "sorpresa", "sorpresa_altro", "sorpresa_salva", "sorpresa_apri",
  "import_link", "import_screenshot", "import_video", "import_manuale", "import_condivisione",
  // Eventi dedicati (16/10): assistente, prenotazioni e raccolte, ricavati dai tipi esistenti
  // ("funzione", "salva", "chiama", "condividi"… con da/via/cosa nel payload): nessuna migrazione.
  "assistente_apri", "assistente_messaggio", "assistente_seguito", "assistente_scheda", "assistente_salva", "assistente_prenota",
  "prenota_whatsapp", "prenota_telefono", "prenota_sito", "prenota_promemoria", "prenota_com_e_andata",
  "raccolta_crea", "raccolta_apri", "raccolta_condividi", "raccolta_modifica", "raccolte_proposte",
] as const;
const AZIONI_DIRETTE = ["apri_scheda", "salva", "rimuovi", "ci_sono_stato", "voglio_andarci", "percorso", "chiama", "sito", "condividi"];

// Nomi leggibili nel pannello (Lorenzo li legge dal telefono): il resto con gli spazi al posto di "_".
const ETICHETTE: Record<string, string> = {
  ricerca_ai: "Ricerca con l'AI",
  domanda_successiva: "Domanda successiva",
  apri_scheda: "Scheda aperta",
  ci_sono_stato: "Ci sono stato",
  voglio_andarci: "Voglio andarci",
  condividi_ricerca: "Condividi ricerca",
  condividi_lista: "Condividi lista",
  condividi_profilo: "Condividi profilo",
  condividi_mappa: "Condividi mappa",
  assistente_apri: "Assistente aperto",
  assistente_messaggio: "Assistente: messaggio",
  assistente_seguito: "Assistente: seguito",
  assistente_scheda: "Assistente: scheda",
  assistente_salva: "Assistente: salva",
  assistente_prenota: "Assistente: prenota",
  assistente_serata: "Assistente: serata a tappe",
  prenota_whatsapp: "Prenota: WhatsApp",
  prenota_telefono: "Prenota: telefono",
  prenota_sito: "Prenota: sito",
  prenota_promemoria: "Prenota: percorso",
  prenota_com_e_andata: "Prenota: com'è andata",
  raccolta_crea: "Raccolta: crea",
  raccolta_apri: "Raccolta: apri",
  raccolta_condividi: "Raccolta: condividi",
  raccolta_modifica: "Raccolta: modifica",
  raccolte_proposte: "Raccolte dall'AI",
  raccolta_pubblica: "raccolta pubblica",
  sorpresa: "Sorprendimi",
  sorpresa_altro: "Sorprendimi: un altro",
  sorpresa_salva: "Sorprendimi: salva",
  sorpresa_apri: "Sorprendimi: scheda",
};
export const etichettaFunzione = (k: string): string => ETICHETTE[k] ?? k.replaceAll("_", " ");

// Funzione dedicata ricavata da un evento di un tipo esistente (null = nessuna).
// Solo chiavi che /api/events conserva: "fonte" dice da dove arriva (assistente, prenota,
// promemoria), "contesto"/"stato" come si prenota o cosa si condivide. ("da", "via" e "cosa"
// si leggono ancora per sicurezza, ma il server li scarta.)
export function funzioneDedicata(type: string, p: Record<string, unknown>): string | null {
  const from = str(p.fonte) ?? str(p.da);
  if (from === "assistente") {
    if (type === "apri_scheda") return "assistente_scheda";
    if (type === "salva") return "assistente_salva";
    return null;
  }
  if (from === "prenota") {
    if (type === "sito") return "prenota_sito";
    if (type === "chiama") return [p.contesto, p.stato, p.via].includes("whatsapp") ? "prenota_whatsapp" : "prenota_telefono";
    if (type === "ci_sono_stato") return "prenota_com_e_andata";
    return null;
  }
  if (from === "promemoria" && type === "percorso") return "prenota_promemoria";
  if (type === "condividi") {
    const cosa = str(p.contesto) ?? str(p.cosa);
    if (cosa === "raccolta") return "raccolta_condividi";
    if (cosa === "profilo" || cosa === "mappa") return `condividi_${cosa}`;
  }
  return null;
}
// Pagine che sono anche funzioni: aprire l'assistente o una propria raccolta.
const PAGINE_FUNZIONE: Record<string, string> = { assistente: "assistente_apri", raccolta: "raccolta_apri" };
const NUOVI_TIPI = ["sessione_inizio", "pagina", "funzione", "errore", "utile"];

const DAY = 86_400_000;
// Giorni nel fuso di Roma: "oggi" è quello di Lorenzo, non quello del server (UTC su Vercel).
const romeDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (t: number | string | Date): string => romeDay.format(new Date(t));
const dayIndex = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY;
const keyOfIndex = (i: number) => new Date(i * DAY).toISOString().slice(0, 10);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10) / 10 : null);

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Conta "volte" e "persone" per chiave, in ordine decrescente.
function tally(): { add: (k: string, actor: string | null) => void; list: () => Conteggio[] } {
  const m = new Map<string, { volte: number; persone: Set<string> }>();
  return {
    add(k, actor) {
      const e = m.get(k) ?? { volte: 0, persone: new Set<string>() };
      e.volte++;
      if (actor) e.persone.add(actor);
      m.set(k, e);
    },
    list: () => [...m].map(([chiave, e]) => ({ chiave, volte: e.volte, persone: e.persone.size })).sort((a, b) => b.volte - a.volte || a.chiave.localeCompare(b.chiave)),
  };
}

export function computeNumeri(rows: EventRow[], giorni: number, now: number = Date.now(), emails: Map<string, string> = new Map()): Numeri {
  // Stessa persona prima e dopo l'accesso: l'anon_id visto insieme a un utente diventa quell'utente.
  const anonToUser = new Map<string, string>();
  for (const r of rows) if (r.user_id && r.anon_id) anonToUser.set(r.anon_id, r.user_id);
  const actorOf = (r: EventRow): string | null => {
    const u = r.user_id ?? (r.anon_id ? anonToUser.get(r.anon_id) : undefined);
    if (u) return `u:${u}`;
    return r.anon_id ? `a:${r.anon_id}` : null;
  };

  const today = dayIndex(dayKey(now));
  const start = today - giorni + 1;
  const ev = rows.map((r) => ({ r, actor: actorOf(r), day: dayIndex(dayKey(r.created_at)), t: Date.parse(r.created_at) }));

  // Storia completa di ogni persona (per "nuovi" e "ritorni").
  const days = new Map<string, Set<number>>();
  for (const e of ev) if (e.actor) (days.get(e.actor) ?? days.set(e.actor, new Set()).get(e.actor)!).add(e.day);
  const first = new Map<string, number>();
  for (const [a, ds] of days) first.set(a, Math.min(...ds));

  const inP = ev.filter((e) => e.day >= start && e.day <= today);
  const actors = new Set(inP.map((e) => e.actor).filter((a): a is string => !!a));
  const registrati = [...actors].filter((a) => a.startsWith("u:")).length;
  const nAttivi = actors.size;

  // Ritorni: tra chi è arrivato per la prima volta nel periodo (almeno N giorni fa),
  // quanti sono tornati N o più giorni dopo il primo giorno.
  const ritorni: Ritorno[] = [1, 3, 7].map((n) => {
    let base = 0, tornati = 0;
    for (const [a, f] of first) {
      if (f < start || f > today - n) continue;
      base++;
      if ([...days.get(a)!].some((d) => d >= f + n)) tornati++;
    }
    return { giorni: n, tornati, base };
  });

  // Sessioni: "sessione_inizio" o, se manca, gli id di sessione visti.
  const sessIds = new Map<string, number[]>();
  for (const e of inP) if (e.r.session_id) (sessIds.get(e.r.session_id) ?? sessIds.set(e.r.session_id, []).get(e.r.session_id)!).push(e.t);
  const inizi = inP.filter((e) => e.r.type === "sessione_inizio").length;
  const nSessioni = Math.max(inizi, sessIds.size);
  const durate = [...sessIds.values()].filter((ts) => ts.length >= 2).map((ts) => (Math.max(...ts) - Math.min(...ts)) / 60_000);
  const durataMediana = median(durate);

  const ricerche = inP.filter((e) => e.r.type === "ricerca");
  const salvataggi = inP.filter((e) => e.r.type === "salva");

  // Imbuto: ricerca → scheda aperta dai risultati → azione (salva, percorso, chiama, sito).
  const AZIONI = ["salva", "percorso", "chiama", "sito"];
  const p1 = new Set(ricerche.map((e) => e.actor).filter(Boolean) as string[]);
  const schede = inP.filter((e) => e.r.type === "apri_scheda" && e.r.props?.fonte === "ricerca");
  const p2 = new Set(schede.map((e) => e.actor).filter((a): a is string => !!a && p1.has(a)));
  const azioni = inP.filter((e) => AZIONI.includes(e.r.type));
  const p3 = new Set(azioni.map((e) => e.actor).filter((a): a is string => !!a && p2.has(a)));
  const imbuto = [
    { passo: "Ricerca", volte: ricerche.length, persone: p1.size },
    { passo: "Scheda aperta dai risultati", volte: schede.length, persone: p2.size },
    { passo: "Salva, percorso, chiama o sito", volte: azioni.length, persone: p3.size },
  ];

  const funzioni = tally();
  const tipi = tally(), zone = tally(), req = tally(), pagine = tally();
  const errori = new Map<string, { messaggio: string; pagina: string; volte: number; persone: Set<string>; ultima: number }>();
  const utile = { si: 0, no: 0 };
  let senzaRisultati = 0, ai = 0, filtri = 0;

  for (const e of inP) {
    const p = e.r.props ?? {};
    switch (e.r.type) {
      case "funzione": { const n = str(p.nome); if (n) funzioni.add(n, e.actor); break; }
      case "ricerca": {
        if (p.modo === "ai") { ai++; funzioni.add("ricerca_ai", e.actor); } else filtri++;
        if (p.risultati === 0) senzaRisultati++;
        tipi.add(str(p.tipo) ?? "non indicato", e.actor);
        zone.add(str(p.zona) ?? (p.vicino_a_me ? "vicino a me" : "non indicata"), e.actor);
        if (Array.isArray(p.requisiti)) for (const q of p.requisiti) if (str(q)) req.add(str(q)!.toLowerCase(), e.actor);
        break;
      }
      case "pagina": {
        const n = str(p.pagina);
        if (n) pagine.add(n, e.actor);
        if (n && PAGINE_FUNZIONE[n]) funzioni.add(PAGINE_FUNZIONE[n], e.actor);
        break;
      }
      case "utile": if (p.voto === "si") utile.si++; else if (p.voto === "no") utile.no++; break;
      case "errore": {
        const messaggio = str(p.messaggio) ?? "(senza messaggio)";
        const pagina = str(p.pagina) ?? "?";
        const k = `${pagina}|${messaggio}`;
        const x = errori.get(k) ?? { messaggio, pagina, volte: 0, persone: new Set<string>(), ultima: 0 };
        x.volte++;
        if (e.actor) x.persone.add(e.actor);
        x.ultima = Math.max(x.ultima, e.t);
        errori.set(k, x);
        break;
      }
      default: {
        if (!AZIONI_DIRETTE.includes(e.r.type)) break;
        const dedicata = funzioneDedicata(e.r.type, p);
        if (dedicata) funzioni.add(dedicata, e.actor);
        // Chiamata o sito per prenotare: contano come prenotazione, non come "chiama"/"sito" dalla scheda.
        if (!dedicata?.startsWith("prenota_")) funzioni.add(e.r.type, e.actor);
      }
    }
  }
  const funzioniList = funzioni.list();
  for (const f of FUNZIONI_NOTE) if (!funzioniList.some((x) => x.chiave === f)) funzioniList.push({ chiave: f, volte: 0, persone: 0 });

  const perGiorno: Giorno[] = [];
  for (let d = start; d <= today; d++) {
    const of = inP.filter((e) => e.day === d);
    const sid = new Set(of.map((e) => e.r.session_id).filter(Boolean));
    perGiorno.push({
      giorno: keyOfIndex(d),
      attivi: new Set(of.map((e) => e.actor).filter(Boolean)).size,
      sessioni: Math.max(of.filter((e) => e.r.type === "sessione_inizio").length, sid.size),
      ricerche: of.filter((e) => e.r.type === "ricerca").length,
      salvataggi: of.filter((e) => e.r.type === "salva").length,
    });
  }

  const tester: Tester[] = [...actors].map((a) => {
    const mine = inP.filter((e) => e.actor === a);
    const sid = new Set(mine.map((e) => e.r.session_id).filter(Boolean));
    const id = a.slice(2);
    return {
      chi: a.startsWith("u:") ? emails.get(id) ?? `utente ${id.slice(0, 8)}` : `anonimo ${id.slice(0, 6)}`,
      registrato: a.startsWith("u:"),
      prima: keyOfIndex(first.get(a)!),
      ultima: new Date(Math.max(...mine.map((e) => e.t))).toISOString(),
      giorniAttivi: new Set(mine.map((e) => e.day)).size,
      sessioni: Math.max(mine.filter((e) => e.r.type === "sessione_inizio").length, sid.size),
      ricerche: mine.filter((e) => e.r.type === "ricerca").length,
      salvati: mine.filter((e) => e.r.type === "salva").length,
      errori: mine.filter((e) => e.r.type === "errore").length,
    };
  }).sort((x, y) => y.ultima.localeCompare(x.ultima));

  return {
    giorni,
    eventi: inP.length,
    attivi: { totale: nAttivi, registrati, anonimi: nAttivi - registrati },
    nuovi: [...actors].filter((a) => first.get(a)! >= start).length,
    ritorni,
    sessioni: { totale: nSessioni, perUtente: ratio(nSessioni, nAttivi), durataMediana: durataMediana === null ? null : Math.round(durataMediana * 10) / 10 },
    ricerche: { totale: ricerche.length, perUtente: ratio(ricerche.length, nAttivi), senzaRisultati, ai, filtri },
    salvataggi: { totale: salvataggi.length, perUtente: ratio(salvataggi.length, nAttivi) },
    imbuto,
    funzioni: funzioniList,
    errori: [...errori.values()].map((x) => ({ messaggio: x.messaggio, pagina: x.pagina, volte: x.volte, persone: x.persone.size, ultima: new Date(x.ultima).toISOString() })).sort((a, b) => b.volte - a.volte),
    ricerchePerTipo: tipi.list(),
    ricerchePerZona: zone.list(),
    requisiti: req.list(),
    pagine: pagine.list(),
    utile,
    perGiorno,
    tester,
    senzaTracciamento: !rows.some((r) => NUOVI_TIPI.includes(r.type)),
  };
}
