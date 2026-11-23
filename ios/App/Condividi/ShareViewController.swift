import UIKit
import UniformTypeIdentifiers

/// "Condividi → Mapetite" da Instagram, TikTok, Google Maps o Safari.
/// Prende il primo link condiviso e apre l'app su "Salva dal reel"
/// (`mapetite://condividi?url=…` → `/importa/condividi?url=…`).
/// Niente rete e niente dati salvati qui: legge solo il link.
class ShareViewController: UIViewController {
    private let etichetta = UILabel()
    private let tasto = UIButton(type: .system)
    private var finito = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x1a / 255, green: 0x3c / 255, blue: 0x40 / 255, alpha: 1)

        etichetta.text = "Apro Mapetite…"
        etichetta.textColor = .white
        etichetta.font = .systemFont(ofSize: 18, weight: .semibold)
        etichetta.numberOfLines = 0
        etichetta.textAlignment = .center

        tasto.setTitle("Chiudi", for: .normal)
        tasto.setTitleColor(.white, for: .normal)
        tasto.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        tasto.backgroundColor = UIColor(red: 1, green: 0x6b / 255, blue: 0x4a / 255, alpha: 1)
        tasto.layer.cornerRadius = 24
        tasto.isHidden = true
        tasto.addTarget(self, action: #selector(chiudi), for: .touchUpInside)

        let pila = UIStackView(arrangedSubviews: [etichetta, tasto])
        pila.axis = .vertical
        pila.spacing = 20
        pila.alignment = .center
        pila.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pila)
        NSLayoutConstraint.activate([
            pila.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            pila.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            pila.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
            tasto.heightAnchor.constraint(equalToConstant: 48),
            tasto.widthAnchor.constraint(equalToConstant: 160),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        cercaLink { [weak self] link in
            DispatchQueue.main.async { self?.usa(link) }
        }
    }

    private func usa(_ link: URL?) {
        guard !finito else { return }
        guard let link = link else {
            mostra("Qui non c'è un link da salvare. Da Instagram o TikTok scegli Condividi sul reel.")
            return
        }
        var dest = URLComponents()
        dest.scheme = "mapetite"
        dest.host = "condividi"
        dest.queryItems = [URLQueryItem(name: "url", value: link.absoluteString)]
        guard let url = dest.url else { return }
        let copiaLink = { [weak self] in
            UIPasteboard.general.url = link
            self?.mostra("Link copiato. Apri Mapetite e tocca Incolla.")
        }
        let trovata = apriApp(url) { [weak self] riuscito in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if riuscito {
                    self.finito = true
                    // Il tempo di passare all'app, poi si chiude il foglio.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        self.extensionContext?.completeRequest(returningItems: nil)
                    }
                } else {
                    copiaLink()
                }
            }
        }
        if !trovata { copiaLink() }
    }

    private func mostra(_ testo: String) {
        etichetta.text = testo
        tasto.isHidden = false
    }

    @objc private func chiudi() {
        finito = true
        extensionContext?.completeRequest(returningItems: nil)
    }

    // MARK: - Lettura del link

    /// Primo link http(s): prima gli allegati "URL", poi il testo
    /// (TikTok e alcune app condividono "Guarda questo video! https://…").
    private func cercaLink(_ fatto: @escaping (URL?) -> Void) {
        let elementi = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let allegati = elementi.flatMap { $0.attachments ?? [] }
        let testoElementi = elementi.compactMap { $0.attributedContentText?.string }.joined(separator: " ")

        let url = UTType.url.identifier
        let testo = UTType.plainText.identifier
        let gruppo = DispatchGroup()
        let raccolta = Raccolta(testo: testoElementi)

        for a in allegati {
            if a.hasItemConformingToTypeIdentifier(url) {
                gruppo.enter()
                a.loadItem(forTypeIdentifier: url, options: nil) { valore, _ in
                    if let u = valore as? URL { raccolta.aggiungi(url: u) }
                    else if let s = valore as? String, let u = URL(string: s) { raccolta.aggiungi(url: u) }
                    gruppo.leave()
                }
            } else if a.hasItemConformingToTypeIdentifier(testo) {
                gruppo.enter()
                a.loadItem(forTypeIdentifier: testo, options: nil) { valore, _ in
                    if let s = valore as? String { raccolta.aggiungi(testo: s) }
                    gruppo.leave()
                }
            }
        }

        gruppo.notify(queue: .main) {
            if let u = raccolta.url.first(where: { Self.eWeb($0) }) { return fatto(u) }
            fatto(Self.primoLink(in: raccolta.testo.joined(separator: " ")))
        }
    }

    static func eWeb(_ u: URL) -> Bool {
        u.scheme == "https" || u.scheme == "http"
    }

    static func primoLink(in testo: String) -> URL? {
        guard !testo.isEmpty,
              let rilevatore = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let tutto = NSRange(testo.startIndex..., in: testo)
        return rilevatore.matches(in: testo, options: [], range: tutto)
            .compactMap { $0.url }
            .first(where: eWeb)
    }

    // MARK: - Apertura dell'app

    /// Un'estensione non può chiamare UIApplication.open direttamente: si
    /// risale la catena dei responder fino all'oggetto applicazione e si
    /// chiama il metodo per selettore (funziona da iOS 15 a iOS 26).
    private func apriApp(_ url: URL, esito: @escaping (Bool) -> Void) -> Bool {
        let sel = NSSelectorFromString("openURL:options:completionHandler:")
        var r: UIResponder? = self
        while let attuale = r {
            if let classe = NSClassFromString("UIApplication"), attuale.isKind(of: classe),
               attuale.responds(to: sel), let imp = attuale.method(for: sel) {
                typealias Apri = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
                let apri = unsafeBitCast(imp, to: Apri.self)
                let blocco: @convention(block) (Bool) -> Void = { esito($0) }
                apri(attuale, sel, url as NSURL, NSDictionary(), blocco as AnyObject)
                return true
            }
            r = attuale.next
        }
        return false
    }
}

/// Raccoglie i risultati delle letture degli allegati, che arrivano da code diverse.
private final class Raccolta: @unchecked Sendable {
    private let blocco = NSLock()
    private var _url: [URL] = []
    private var _testo: [String]

    init(testo: String) { _testo = [testo] }

    func aggiungi(url: URL) { blocco.lock(); _url.append(url); blocco.unlock() }
    func aggiungi(testo: String) { blocco.lock(); _testo.append(testo); blocco.unlock() }
    var url: [URL] { blocco.lock(); defer { blocco.unlock() }; return _url }
    var testo: [String] { blocco.lock(); defer { blocco.unlock() }; return _testo }
}
