import UIKit
import Capacitor

/// Il contenitore dell'app: la Mapetite del sito più l'accesso con Google
/// fatto come vuole Google (fuori dalla WebView) e l'apertura dei link
/// condivisi da Instagram e TikTok.
class MapetiteViewController: CAPBridgeViewController {
    /// Pagina da aprire appena la WebView è pronta (avvio da un link).
    private var inSospeso: URL?
    private var pronta = false

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
    }

    /// Apre una pagina del nostro sito dentro l'app.
    func apri(_ url: URL) {
        guard Sito.eNostro(url) else { return }
        guard pronta, let webView = webView else {
            inSospeso = url
            return
        }
        webView.load(URLRequest(url: url))
    }
}
