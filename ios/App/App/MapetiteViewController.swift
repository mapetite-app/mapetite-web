import UIKit
import Network
import Capacitor

/// Il contenitore dell'app: la Mapetite del sito più l'accesso con Google
/// fatto come vuole Google (fuori dalla WebView), l'apertura dei link
/// condivisi da Instagram e TikTok e un avviso nostro quando manca la rete
/// (mai la pagina d'errore del browser).
class MapetiteViewController: CAPBridgeViewController {
    /// Pagina da aprire appena la WebView è pronta (avvio da un link).
    private var inSospeso: URL?
    private var pronta = false

    private let rete = NWPathMonitor()
    private var senzaRete: UIView?
    /// Da ricaricare quando torna la rete: vero se la pagina non è mai arrivata.
    private var daRicaricare = false

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AccessoNativoPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        pronta = true
        if let url = inSospeso {
            inSospeso = nil
            apri(url)
        }
        rete.pathUpdateHandler = { [weak self] percorso in
            DispatchQueue.main.async { self?.aggiorna(online: percorso.status == .satisfied) }
        }
        rete.start(queue: DispatchQueue(label: "app.mapetite.rete"))
    }

    deinit { rete.cancel() }

    /// Apre una pagina del nostro sito dentro l'app.
    func apri(_ url: URL) {
        guard Sito.eNostro(url) else { return }
        guard pronta, let webView = webView else {
            inSospeso = url
            return
        }
        webView.load(URLRequest(url: url))
    }

    // MARK: - Senza rete

    private func aggiorna(online: Bool) {
        if online {
            guard let avviso = senzaRete else { return }
            senzaRete = nil
            UIView.animate(withDuration: 0.2, animations: { avviso.alpha = 0 }) { _ in avviso.removeFromSuperview() }
            if daRicaricare {
                daRicaricare = false
                if webView?.url == nil || webView?.url?.scheme != "https" {
                    if let base = bridge?.config.serverURL { webView?.load(URLRequest(url: base)) }
                } else {
                    webView?.reload()
                }
            }
        } else if senzaRete == nil {
            // La pagina era già aperta: resta sotto l'avviso, si ricarica solo se vuota.
            daRicaricare = (webView?.title ?? "").isEmpty
            mostraSenzaRete()
        }
    }

    private func mostraSenzaRete() {
        let fondo = UIView()
        fondo.backgroundColor = UIColor(red: 0x1a / 255, green: 0x3c / 255, blue: 0x40 / 255, alpha: 1)
        fondo.translatesAutoresizingMaskIntoConstraints = false

        let titolo = UILabel()
        titolo.text = "Sei senza rete"
        titolo.font = .systemFont(ofSize: 22, weight: .bold)
        titolo.textColor = .white
        titolo.textAlignment = .center

        let testo = UILabel()
        testo.text = "Mapetite torna da sola appena il telefono si ricollega."
        testo.font = .systemFont(ofSize: 16)
        testo.textColor = UIColor.white.withAlphaComponent(0.8)
        testo.numberOfLines = 0
        testo.textAlignment = .center

        let pila = UIStackView(arrangedSubviews: [titolo, testo])
        pila.axis = .vertical
        pila.spacing = 10
        pila.translatesAutoresizingMaskIntoConstraints = false
        fondo.addSubview(pila)
        view.addSubview(fondo)
        NSLayoutConstraint.activate([
            fondo.topAnchor.constraint(equalTo: view.topAnchor),
            fondo.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            fondo.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            fondo.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pila.centerYAnchor.constraint(equalTo: fondo.centerYAnchor),
            pila.leadingAnchor.constraint(equalTo: fondo.leadingAnchor, constant: 32),
            pila.trailingAnchor.constraint(equalTo: fondo.trailingAnchor, constant: -32),
        ])
        senzaRete = fondo
    }
}
