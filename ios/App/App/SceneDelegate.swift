import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let principale = MapetiteViewController()
        // Avvio a freddo dal Condividi: la pagina giusta si apre al posto della home.
        for contesto in connectionOptions.urlContexts {
            if let pagina = Sito.paginaCondividi(da: contesto.url) { principale.apri(pagina) }
        }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = principale
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for contesto in URLContexts {
            if let pagina = Sito.paginaCondividi(da: contesto.url) {
                (window?.rootViewController as? MapetiteViewController)?.apri(pagina)
            }
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
