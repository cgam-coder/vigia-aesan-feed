import XCTest
import Foundation

// Owner-authorized public Preview tests, on a NEW disposable iOS Simulator only.
// No Web Inspector, RPC, JavaScript, account access, cookies, or storage reads.
// Native screenshots and the public controls' accessibility values are the evidence.
final class PublicSafariTests: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    let origin = "https://8c4df878-vigia-runtime.c-gamiz93.workers.dev"
    var web: XCUIElement { safari.webViews.firstMatch }
    var activeCase = "setup"
    var serial = 0
    enum Stop: Error { case prerequisite(String); case result(String) }
    func need(_ ok: Bool, _ why: String) throws {
        if !ok { throw Stop.prerequisite(why) }
    }
    func expect(_ ok: Bool, _ why: String) throws {
        if !ok { throw Stop.result(why) }
    }
    func pause() { RunLoop.current.run(until: Date().addingTimeInterval(0.5)) }
    func frame(_ e: XCUIElement) -> [String: Double] {
        guard e.exists else { return [:] }
        let r = e.frame
        return ["x":Double(r.minX),"y":Double(r.minY),"width":Double(r.width),"height":Double(r.height)]
    }
    func capture(_ stage: String, _ values: [String:Any] = [:]) {
        serial += 1
        var s = values
        s["case"] = activeCase; s["stage"] = stage; s["sequence"] = serial
        s["timeMs"] = Int64(Date().timeIntervalSince1970 * 1000)
        s["webFrame"] = frame(web)
        s["keyboardVisible"] = safari.keyboards.firstMatch.exists
        s["orientation"] = XCUIDevice.shared.orientation.rawValue
        if let data = try? JSONSerialization.data(withJSONObject:s,options:[.sortedKeys]) {
            let a = XCTAttachment(data:data,uniformTypeIdentifier:"public.json")
            a.name = "public-ui-\(activeCase)-\(stage)-state"; a.lifetime = .keepAlways; add(a)
        }
        if stage == "outcome" { return }
        let image = XCTAttachment(screenshot:safari.screenshot())
        image.name = "public-ui-\(activeCase)-\(stage)-image"; image.lifetime = .keepAlways; add(image)
        print("PUBLIC_UI_STAGE \(activeCase) \(stage)")
    }
    func run(_ id: String, _ body: () throws -> Void) {
        activeCase = id; print("PUBLIC_UI_STARTED \(id)")
        do { try body(); capture("outcome",["actionsAndAssertions":"COMPLETED","visualReview":"PENDING"]) }
        catch { capture("failure",["actionsAndAssertions":"INCOMPLETE","reason":String(describing:error)]) }
    }
    func tap(_ e: XCUIElement) throws {
        try need(e.waitForExistence(timeout:5) && e.isHittable,"native control not available")
        e.tap(); pause()
    }
    func navigate(_ path: String = "/es/alertas") throws {
        try need(path == "/es/alertas" || path == "/es/alertas?source=AESAN&q=cacahuete", "path not permitted")
        XCUIDevice.shared.orientation = .portrait
        safari.activate(); try need(safari.wait(for:.runningForeground,timeout:8),"Safari foreground")
        for title in ["Continue","Not Now"] {
            let e = safari.buttons[title]
            if e.waitForExistence(timeout:1) && e.isHittable { e.tap() }
        }
        let address = safari.textFields.matching(NSPredicate(format:"identifier == %@ OR label CONTAINS[c] %@ OR label CONTAINS[c] %@","URL","Address","Search")).firstMatch
        try tap(address); address.typeText(origin + path + "\n")
        try need(web.waitForExistence(timeout:12),"public Preview WebView")
        let theme = web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Activar modo")).firstMatch
        var ready = false
        for _ in 0..<20 {
            if theme.exists || web.buttons["Rechazar analítica"].exists || web.buttons["Aceptar analítica"].exists { ready = true; break }
            pause()
        }
        try need(ready,"public Preview client controls")
        pause()
    }
    func prepare(_ path: String = "/es/alertas") throws {
        try navigate(path)
        let reject = web.buttons["Rechazar analítica"]
        if reject.exists { try tap(reject) }
    }
    func gone(_ e: XCUIElement) -> Bool {
        let p = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:e)
        return XCTWaiter.wait(for:[p],timeout:5) == .completed
    }
    func reveal(_ e: XCUIElement) throws {
        for _ in 0..<3 {
            if e.exists && e.isHittable { return }
            web.swipeUp(); pause()
        }
        try need(e.exists && e.isHittable,"control unavailable after bounded scroll")
    }
    func testCoreBlock() {
        continueAfterFailure = false
        run("consent-reject") {
            try self.navigate(); self.capture("before")
            let e = self.web.buttons["Rechazar analítica"]
            try self.tap(e); try self.expect(self.gone(e),"consent remains open")
            self.capture("clicked"); try self.navigate()
            try self.expect(!e.exists && !self.web.buttons["Aceptar analítica"].exists,"consent returns after reload")
            self.capture("after-reload")
        }
        run("theme") {
            try self.prepare(); self.capture("before")
            try self.tap(self.web.buttons["Activar modo oscuro"])
            try self.expect(self.web.buttons["Activar modo claro"].waitForExistence(timeout:5),"dark choice not observed")
            self.capture("selected"); try self.navigate()
            try self.expect(self.web.buttons["Activar modo claro"].waitForExistence(timeout:5),"dark choice not persistent")
            self.capture("after-reload",["osBaseline":"runner must verify light","liveOSOverride":"NOT_OBSERVED"])
        }
        run("menu") {
            try self.prepare(); self.capture("before")
            let menu = self.web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Menú")).firstMatch
            try self.tap(menu)
            let links = self.web.links.matching(NSPredicate(format:"label == %@","Fuentes")).allElementsBoundByIndex.filter { $0.isHittable && $0.frame.minY < self.web.frame.midY }
            try self.expect(links.count == 1,"mobile menu link not uniquely visible")
            self.capture("open",["linkFrame":self.frame(links[0])])
            try self.tap(menu); try self.expect(!links[0].isHittable,"mobile menu remains exposed"); self.capture("closed")
        }
        run("filters") {
            try self.prepare(); self.capture("before")
            let trigger = self.web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Filtros")).firstMatch
            try self.reveal(trigger); try self.tap(trigger)
            let select = self.web.popUpButtons.matching(NSPredicate(format:"identifier == %@ OR label CONTAINS[c] %@ OR value CONTAINS[c] %@","terminal-country","país","Todos")).firstMatch
            let country = select.exists ? select : self.web.buttons.matching(NSPredicate(format:"identifier == %@ OR label CONTAINS[c] %@","terminal-country","Todos los países")).firstMatch
            try self.tap(country)
            let wheel = self.safari.pickerWheels.firstMatch
            if wheel.waitForExistence(timeout:2) {
                wheel.adjust(toPickerWheelValue:"España")
                if self.safari.buttons["Done"].exists { self.safari.buttons["Done"].tap() }
            } else { try self.tap(self.safari.buttons["España"]) }
            self.capture("applied",["countryValue":String(describing:country.value)])
            try self.expect(country.label.contains("España") || String(describing:country.value).contains("España"),"country change not observed")
            let reset = self.web.buttons["Restablecer filtros"]
            try self.reveal(reset); try self.tap(reset); self.capture("reset")
            try self.tap(self.web.buttons["Ver resultados"])
            self.capture("closed",["domFocusReturn":"NOT_OBSERVED","triggerHittable":trigger.isHittable])
        }
        run("keyboard") {
            try self.prepare()
            let input = self.web.searchFields.firstMatch
            try self.need(input.exists,"public search input")
            let before = self.frame(input); self.capture("before",["inputFrame":before])
            try self.tap(input)
            try self.expect(self.safari.keyboards.firstMatch.waitForExistence(timeout:5),"software keyboard missing")
            self.capture("focused",["inputFrame":self.frame(input),"keyboardFrame":self.frame(self.safari.keyboards.firstMatch),"cssViewportScale":"NOT_OBSERVED"])
            input.typeText("cacahuete\n")
            let result = self.web.links.matching(NSPredicate(format:"label CONTAINS[c] %@","cacahuete")).firstMatch
            try self.expect(result.waitForExistence(timeout:12),"expected search result missing")
            self.capture("results",["resultLabel":result.label])
        }
        run("orientation") {
            try self.prepare(); self.capture("portrait")
            XCUIDevice.shared.orientation = .landscapeLeft; self.pause()
            try self.expect(self.web.frame.width > self.web.frame.height,"landscape dimensions not observed")
            self.capture("landscape"); XCUIDevice.shared.orientation = .portrait; self.pause(); self.capture("restored")
        }
        run("scroll") {
            try self.prepare(); self.capture("before")
            self.web.swipeUp(); self.pause(); self.capture("scrolled")
            self.web.swipeDown(); self.pause(); self.capture("returned")
        }
        run("pinch") {
            try self.prepare(); self.capture("before")
            self.web.pinch(withScale:1.3,velocity:1); self.pause(); self.capture("zoomed")
            self.web.pinch(withScale:1/1.3,velocity:-1); self.pause(); self.capture("restored",["cssViewportScale":"NOT_OBSERVED"])
        }
    }
    func testJourneyBlock() {
        continueAfterFailure = false
        run("consent-accept") {
            try self.navigate(); self.capture("clean-before")
            let e = self.web.buttons["Aceptar analítica"]
            try self.tap(e); try self.expect(self.gone(e),"consent remains open")
            self.capture("clicked"); try self.navigate()
            try self.expect(!e.exists && !self.web.buttons["Rechazar analítica"].exists,"consent returns after reload")
            self.capture("after-reload",["storedChoice":"NOT_READ","analyticsNetwork":"NOT_OBSERVED"])
        }
        run("map") {
            try self.prepare("/es/alertas?source=AESAN&q=cacahuete")
            let ref = self.web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","ES2026/575")).firstMatch
            try self.need(ref.waitForExistence(timeout:10),"required map control record missing")
            let maps = self.web.buttons.matching(NSPredicate(format:"label == %@","Ver en mapa"))
            try self.need(maps.count == 1,"map target must be unique")
            let map = maps.firstMatch
            try self.reveal(map); self.capture("before",["reference":ref.label])
            try self.tap(map)
            try self.expect(self.web.buttons["Mostrada en el mapa"].waitForExistence(timeout:5),"map selection missing")
            self.capture("selected",["geography":"REQUIRES_VISUAL_REVIEW"])
        }
        run("detail") {
            try self.prepare("/es/alertas?source=AESAN&q=cacahuete")
            let link = self.web.links.matching(NSPredicate(format:"label CONTAINS[c] %@","cacahuete")).firstMatch
            try self.reveal(link); self.capture("before",["link":link.label]); try self.tap(link)
            let ref = self.web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","ES2026/575")).firstMatch
            try self.expect(ref.waitForExistence(timeout:10),"detail reference missing"); self.capture("opened",["reference":ref.label])
            try self.tap(self.safari.buttons["Back"]); self.capture("back")
        }
    }
}
