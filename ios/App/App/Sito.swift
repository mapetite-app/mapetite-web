import Foundation

/// Indirizzi del sito Mapetite usati dall'app iPhone.
/// Deve restare uguale a `server.url` di `capacitor.config.ts`.
enum Sito {
    static let base = URL(string: "https://mapetite-web.vercel.app")!
    static let host = "mapetite-web.vercel.app"
    /// Schema dei link interni dell'app (`mapetite://…`), usato dal
    /// Condividi e dal ritorno dall'accesso con Google.
    static let schema = "mapetite"

    /// `mapetite://condividi?url=…` → pagina "Salva dal reel" del sito.
    /// Il sito ricontrolla il link (`/importa/condividi`), qui si passa e basta.
    static func paginaCondividi(da link: URL) -> URL? {
        guard link.scheme == schema, link.host == "condividi",
              let condiviso = URLComponents(url: link, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "url" })?.value,
              !condiviso.isEmpty else { return nil }
        var pagina = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        pagina.path = "/importa/condividi"
        pagina.queryItems = [URLQueryItem(name: "url", value: condiviso)]
        return pagina.url
    }

    /// Vero solo per pagine del nostro sito (https, stesso host).
    static func eNostro(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == host
    }
}
