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
        if apriApp(url) {
            finito = true
            // Il tempo di passare all'app, poi si chiude il foglio.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil)
            }
        } else {
            UIPasteboard.general.url = link
            mostra("Link copiato. Apri Mapetite e tocca Incolla.")
        }
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
        var daURL: [URL] = []
        var daTesto: [String] = [testoElementi]
        let blocco = NSLock()

        for a in allegati {
            if a.hasItemConformingToTypeIdentifier(url) {
                gruppo.enter()
                a.loadItem(forTypeIdentifier: url, options: nil) { valore, _ in
                    blocco.lock()
                    if let u = valore as? URL { daURL.append(u) }
                    else if let s = valore as? String, let u = URL(string: s) { daURL.append(u) }
                    blocco.unlock()
                    gruppo.leave()
                }
            } else if a.hasItemConformingToTypeIdentifier(testo) {
                gruppo.enter()
                a.loadItem(forTypeIdentifier: testo, options: nil) { valore, _ in
                    blocco.lock()
                    if let s = valore as? String { daTesto.append(s) }
                    blocco.unlock()
                    gruppo.leave()
                }
            }
        }

        gruppo.notify(queue: .main) {
            if let u = daURL.first(where: { Self.eWeb($0) }) { return fatto(u) }
            fatto(Self.primoLink(in: daTesto.joined(separator: " ")))
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
    private func apriApp(_ url: URL) -> Bool {
        let sel = NSSelectorFromString("openURL:options:completionHandler:")
        var r: UIResponder? = self
        while let attuale = r {
            if let classe = NSClassFromString("UIApplication"), attuale.isKind(of: classe),
               attuale.responds(to: sel), let imp = attuale.method(for: sel) {
                typealias Apri = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
                let apri = unsafeBitCast(imp, to: Apri.self)
                apri(attuale, sel, url as NSURL, NSDictionary(), nil)
                return true
            }
            r = attuale.next
        }
        return false
    }
}
