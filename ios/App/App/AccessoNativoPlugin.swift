import Foundation
import AuthenticationServices
import WebKit
import Capacitor

/// Google non permette l'accesso dentro una WebView ("disallowed_useragent").
/// Quando il sito manda a Supabase per l'accesso con un provider, qui lo si
/// apre in ASWebAuthenticationSession (il foglio di Safari che Apple e Google
/// accettano) e al ritorno si carica la pagina di conferma dentro l'app, dove
/// c'è già il cookie del codice di verifica (PKCE) messo dal sito.
///
/// Giro completo:
/// 1. il sito apre `https://<progetto>.supabase.co/auth/v1/authorize?…&redirect_to=<conferma>`;
/// 2. qui si cambia `redirect_to` in `<sito>/auth/app-ritorno?dopo=<conferma>`;
/// 3. dopo Google, Supabase manda a `app-ritorno?dopo=…&code=…`, che risponde
///    con `mapetite://accesso?dopo=…&code=…` e chiude il foglio;
/// 4. qui si carica `<conferma>?…&code=…` nella WebView: il sito fa il resto.
@objc(AccessoNativoPlugin)
public class AccessoNativoPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "AccessoNativoPlugin"
    public let jsName = "AccessoNativo"
    public let pluginMethods: [CAPPluginMethod] = []

    private var sessione: ASWebAuthenticationSession?

    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url,
              let daAprire = Self.authorizeRiscritto(url) else { return nil }
        DispatchQueue.main.async { [weak self] in self?.avvia(daAprire) }
        return true
    }

    /// L'URL di Supabase con `redirect_to` che passa da `/auth/app-ritorno`,
    /// oppure nil se non è un accesso con provider verso il nostro sito.
    static func authorizeRiscritto(_ url: URL) -> URL? {
        guard url.scheme == "https",
              let host = url.host, host.hasSuffix(".supabase.co"),
              url.path == "/auth/v1/authorize",
              var comp = URLComponents(url: url, resolvingAgainstBaseURL: false),
              var items = comp.queryItems,
              let i = items.firstIndex(where: { $0.name == "redirect_to" }),
              let dopo = items[i].value, let dopoURL = URL(string: dopo),
              Sito.eNostro(dopoURL) else { return nil }
        var ritorno = URLComponents(url: Sito.base, resolvingAgainstBaseURL: false)!
        ritorno.path = "/auth/app-ritorno"
        ritorno.queryItems = [URLQueryItem(name: "dopo", value: dopo)]
        guard let r = ritorno.url?.absoluteString else { return nil }
        items[i] = URLQueryItem(name: "redirect_to", value: r)
        comp.queryItems = items
        // "+" nei valori: URLComponents non lo codifica, Supabase lo leggerebbe come spazio.
        comp.percentEncodedQuery = comp.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        return comp.url
    }

    /// Da `mapetite://accesso?dopo=<conferma>&code=…` alla pagina di conferma
    /// con tutti i parametri tranne `dopo` (code, oppure error ed error_description).
    static func paginaConferma(da callback: URL) -> URL? {
        guard callback.scheme == Sito.schema, callback.host == "accesso",
              let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
              let dopo = items.first(where: { $0.name == "dopo" })?.value,
              let dopoURL = URL(string: dopo), Sito.eNostro(dopoURL),
              var comp = URLComponents(url: dopoURL, resolvingAgainstBaseURL: false) else { return nil }
        let altri = items.filter { $0.name != "dopo" }
        comp.queryItems = (comp.queryItems ?? []) + altri
        return comp.url
    }

    private func avvia(_ url: URL) {
        sessione?.cancel()
        let s = ASWebAuthenticationSession(url: url, callbackURLScheme: Sito.schema) { [weak self] callback, errore in
            DispatchQueue.main.async {
                self?.sessione = nil
                let principale = self?.bridge?.viewController as? MapetiteViewController
                guard errore == nil, let callback = callback,
                      let pagina = Self.paginaConferma(da: callback) else {
                    // Annullato o fallito: la server action del sito resta in attesa
                    // del redirect che abbiamo fermato, quindi si ricarica /login.
                    principale?.apri(Sito.base.appendingPathComponent("login"))
                    return
                }
                principale?.apri(pagina)
            }
        }
        s.presentationContextProvider = self
        // Ricorda l'account Google già usato in Safari: un tocco invece di email e password.
        s.prefersEphemeralWebBrowserSession = false
        sessione = s
        s.start()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
