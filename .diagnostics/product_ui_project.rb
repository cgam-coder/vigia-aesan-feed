# Public immutable Preview only; no application source or credentials.
require 'xcodeproj'
require 'fileutils'
FileUtils.mkdir_p('ProductUI')
File.write('ProductUI/Harness.swift', <<~SWIFT)
import UIKit
@main final class HarnessDelegate: UIResponder, UIApplicationDelegate {
 var window:UIWindow?
 func application(_ application:UIApplication,didFinishLaunchingWithOptions options:[UIApplication.LaunchOptionsKey:Any]?) -> Bool {
  window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=UIViewController();window?.makeKeyAndVisible();return true
 }
}
SWIFT
# Literal heredoc retains Swift escapes; same already verified scheme/activation route.
File.write('ProductUI/ProductUITests.swift', <<~'SWIFT')
import XCTest
final class ProductUITests:XCTestCase {
 let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
 let target="https://8c4df878-vigia-runtime.c-gamiz93.workers.dev/es/alertas"
 var start=Date();var current="setup";var states:[String:Any]=[:]
 var searchSucceeded=false
 var web:XCUIElement { safari.webViews.firstMatch }
 enum Stop:Error { case blocked(String) }
 func check(_ ok:Bool,_ text:String) throws { if !ok { throw Stop.blocked(text) } }
 func snapshot(_ caseName:String,_ phase:String,_ values:[String:Any]=[:]) {
  var data=values;data["case"]=caseName;data["stage"]=caseName+"-"+phase;data["phase"]=phase;data["dateMs"]=Int64(Date().timeIntervalSince1970*1000);data["testIdentifier"]="ProductUITests/testProductBlock()"
  data["webFrame"]=web.exists ? NSStringFromCGRect(web.frame) : "unavailable";data["keyboardVisible"]=safari.keyboards.firstMatch.exists
  if let bytes=try? JSONSerialization.data(withJSONObject:data,options:[.sortedKeys]) {
   let state=XCTAttachment(data:bytes,uniformTypeIdentifier:"public.json");state.name="product-state-"+caseName+"-"+phase;state.lifetime = .keepAlways;add(state)
  }
  if phase == "entered" { print("PRODUCT_STAGE "+caseName+" "+phase);return }
  let shot=XCTAttachment(screenshot:safari.screenshot());shot.name="product-"+caseName+"-"+phase;shot.lifetime = .keepAlways;add(shot)
  print("PRODUCT_STAGE "+caseName+" "+phase)
 }
 func run(_ name:String,_ body:() throws -> [String:Any]) {
  current=name
  if Date().timeIntervalSince(start)>165 { snapshot(name,"after",["execution":"NOT_EXECUTED","product":"UNKNOWN","reason":"bounded native test budget"]);return }
  snapshot(name,"entered",["execution":"STARTED"])
  do { let result=try body();snapshot(name,"after",result.merging(["execution":"EXECUTED","product":"OBSERVED_PASS"],uniquingKeysWith:{$1})) }
  catch {snapshot(name,"after",["execution":"ATTEMPTED","product":"HOLD","error":String(describing:error)])}
 }
 func navigate(_ url:String) throws {
  safari.activate();try check(safari.wait(for:.runningForeground,timeout:8),"Safari foreground not verified")
  let address=safari.textFields.matching(NSPredicate(format:"identifier == %@ OR label CONTAINS[c] %@ OR label CONTAINS[c] %@","URL","Address","Search")).firstMatch
  try check(address.waitForExistence(timeout:5),"Native address field absent")
  address.tap();address.typeText(url+"\n")
  try check(web.waitForExistence(timeout:12),"WebView absent after navigation")
  RunLoop.current.run(until:Date().addingTimeInterval(2))
  let finalAddress=safari.textFields.matching(NSPredicate(format:"identifier == %@","URL")).firstMatch
  if finalAddress.exists { print("PRODUCT_NAVIGATION_ADDRESS "+String(describing:finalAddress.value)) }
 }
 func tap(_ e:XCUIElement,_ message:String) throws {try check(e.waitForExistence(timeout:5),message+" missing");try check(e.isHittable,message+" not hittable");e.tap()}
 func gone(_ e:XCUIElement,_ timeout:TimeInterval=5) -> Bool {
  let expectation=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:e)
  return XCTWaiter.wait(for:[expectation],timeout:timeout) == .completed
 }
 override func tearDownWithError() throws {
  snapshot("final","after",["execution":"FINISHED","lastCase":current])
  let raw=Data(String(safari.debugDescription.prefix(24000)).utf8);let a=XCTAttachment(data:raw,uniformTypeIdentifier:"public.plain-text");a.name="product-accessibility-final";a.lifetime = .keepAlways;add(a)
 }
 func testProductBlock() throws {
  continueAfterFailure=false;start=Date();XCUIDevice.shared.orientation = .portrait
  run("consent") {
   try self.navigate(self.target)
   self.snapshot("consent","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let reject=self.web.buttons["Rechazar analítica"]
   try self.tap(reject,"Consent reject");try self.check(self.gone(reject),"Consent did not close")
   try self.navigate(self.target)
   try self.check(self.web.buttons["Activar modo oscuro"].waitForExistence(timeout:10) || self.web.buttons["Activar modo claro"].exists,"Client controls not ready after reload")
   try self.check(!reject.exists && !self.web.buttons["Aceptar analítica"].exists,"Consent returned after reload")
   return ["choice":"rejected","closed":true,"persistedAfterReload":true]
  }
  run("theme") {
   try self.navigate(self.target)
   self.snapshot("theme","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let dark=self.web.buttons["Activar modo oscuro"];let light=self.web.buttons["Activar modo claro"]
   try self.check(dark.waitForExistence(timeout:6),"Light baseline toggle not observed")
   try self.tap(dark,"Manual theme");try self.check(light.waitForExistence(timeout:5),"Dark UI toggle absent after tap")
   self.snapshot("theme","selected",["manualChoice":"dark"])
   try self.navigate(self.target)
   try self.check(light.waitForExistence(timeout:10),"Manual dark selection not persistent")
   return ["manualChoice":"dark","persistentReload":true,"precedence":"requires runner OS light observation","themeButton":light.label]
  }
  run("menu") {
   try self.navigate(self.target)
   self.snapshot("menu","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let menu=self.web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Menú")).firstMatch
   try self.tap(menu,"Menu")
   let link=self.web.links["Fuentes"];try self.check(link.waitForExistence(timeout:5) && link.isHittable,"Mobile menu link not accessible")
   self.snapshot("menu","open",["linkFrame":NSStringFromCGRect(link.frame)])
   try self.tap(menu,"Menu close");try self.check(!link.isHittable,"Mobile links remain hittable after close")
   return ["openedClosed":true]
  }
  run("filters") {
   try self.navigate(self.target)
   self.snapshot("filters","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let trigger=self.web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Filtros")).firstMatch
   for _ in 0..<2 { if !trigger.isHittable { self.web.swipeUp() } }
   try self.tap(trigger,"Filters")
   let countryMatch=NSPredicate(format:"label == %@ OR label CONTAINS %@ OR label == %@","País","Todos los países","España")
   let popup=self.web.popUpButtons.matching(countryMatch).firstMatch
   let country=popup.exists ? popup : self.web.buttons.matching(countryMatch).firstMatch
   try self.tap(country,"Country selection")
   if self.safari.pickerWheels.firstMatch.waitForExistence(timeout:2) {
    self.safari.pickerWheels.firstMatch.adjust(toPickerWheelValue:"España")
    let done=self.safari.buttons["Done"];if done.exists { done.tap() }
   } else { try self.tap(self.safari.buttons["España"],"Spain option") }
   try self.check(country.label.contains("España") || String(describing:country.value).contains("España"),"Spain selection not reflected")
   self.snapshot("filters","applied",["countryLabel":country.label,"countryValue":String(describing:country.value)])
   let reset=self.web.buttons["Restablecer filtros"];try self.tap(reset,"Reset filters")
   try self.check(country.label.contains("Todos") || String(describing:country.value).contains("Todos"),"Filter reset not reflected")
   try self.tap(self.web.buttons["Ver resultados"],"Close filters")
   return ["countryApplied":"España","resetObserved":true,"focusReturn":"not certified from accessibility alone"]
  }
  run("keyboard") {
   try self.navigate(self.target)
   self.snapshot("keyboard","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let input=self.web.searchFields.firstMatch.exists ? self.web.searchFields.firstMatch : self.web.textFields["Buscar en todo el archivo NagameAlert"]
   try self.tap(input,"Global search")
   try self.check(self.safari.keyboards.firstMatch.waitForExistence(timeout:5),"Native software keyboard absent")
   self.snapshot("keyboard","focused",["inputFrame":NSStringFromCGRect(input.frame),"keyboardFrame":NSStringFromCGRect(self.safari.keyboards.firstMatch.frame),"inputValue":String(describing:input.value)])
   input.typeText("cacahuete")
   if self.safari.keyboards.buttons["Search"].exists { self.safari.keyboards.buttons["Search"].tap() } else { input.typeText("\n") }
   let result=self.web.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@","Advertencia para personas")).firstMatch
   try self.check(result.waitForExistence(timeout:12),"Expected peanut result not found")
   self.searchSucceeded=true
   return ["nativeKeyboard":true,"query":"cacahuete","resultLabel":result.label,"keyboardAfter":self.safari.keyboards.firstMatch.exists]
  }
  run("map") {
   try self.check(self.searchSucceeded,"DEPENDENCY: native search was not verified; map case not certified")
   self.snapshot("map","before",["execution":"STARTED"])
   let button=self.web.buttons["Ver en mapa"].firstMatch
   for _ in 0..<3 {if !button.isHittable {self.web.swipeUp()} }
   try self.tap(button,"Map action")
   try self.check(self.web.buttons["Mostrada en el mapa"].waitForExistence(timeout:5),"Selected map state absent")
   return ["mapSelection":true,"geography":"visual review required"]
  }
  run("detail") {
   try self.check(self.searchSucceeded,"DEPENDENCY: native search was not verified; detail case not certified")
   self.snapshot("detail","before",["execution":"STARTED"])
   let link=self.web.links.matching(NSPredicate(format:"label BEGINSWITH %@ AND label CONTAINS[c] %@","Ver ficha de NagameAlert","cacahuete")).firstMatch
   for _ in 0..<3 {if !link.isHittable {self.web.swipeDown()} }
   try self.tap(link,"Peanut detail")
   let heading=self.web.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@","cacahuete")).firstMatch
   try self.check(heading.waitForExistence(timeout:10),"Peanut detail content absent")
   let observedContent=heading.label
   self.snapshot("detail","opened",["content":observedContent])
   let back=self.safari.buttons["Back"];try self.tap(back,"Safari back")
   try self.check(self.web.buttons["Ver en mapa"].firstMatch.waitForExistence(timeout:10),"Result list not returned")
   return ["detailOpenedBack":true,"content":observedContent,"routeVerification":"visual/native address review required"]
  }
  run("orientation") {
   self.snapshot("orientation","before",["execution":"STARTED"])
   XCUIDevice.shared.orientation = .landscapeLeft
   let end=Date().addingTimeInterval(6)
   while self.web.frame.width<=self.web.frame.height && Date()<end {RunLoop.current.run(until:Date().addingTimeInterval(0.2))}
   self.snapshot("orientation","landscape",["orientation":"landscapeLeft"])
   try self.check(self.web.frame.width>self.web.frame.height,"Native WebView did not rotate")
   XCUIDevice.shared.orientation = .portrait;RunLoop.current.run(until:Date().addingTimeInterval(1));self.web.swipeUp();self.snapshot("orientation","scrolled",["gesture":"native swipeUp"]);self.web.swipeDown()
   return ["nativeRotation":true,"nativeScroll":true]
  }
  run("pinch") {
   try self.navigate(self.target)
   self.snapshot("pinch","before",["execution":"STARTED","target":"immutable candidate Preview"])
   let heading=self.web.staticTexts["Resultados"]
   for _ in 0..<2 {if !heading.isHittable {self.web.swipeUp()} }
   try self.check(heading.exists,"Results heading not available")
   let before=heading.frame.width;self.web.pinch(withScale:1.4,velocity:1)
   try self.check(heading.frame.width>before*1.1,"Native pinch enlargement unverified")
   return ["nativePinch":true,"beforeWidth":before,"afterWidth":heading.frame.width]
  }
 }
}
SWIFT
project=Xcodeproj::Project.new('ProductUI/ProductUI.xcodeproj')
app=project.new_target(:application,'Harness',:ios,'18.5');tests=project.new_target(:ui_test_bundle,'ProductUITests',:ios,'18.5')
app.add_file_references([project.main_group.new_file('Harness.swift')]);tests.add_file_references([project.main_group.new_file('ProductUITests.swift')]);tests.add_dependency(app)
[app,tests].each do |target|
 target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION']='5.0';config.build_settings['CODE_SIGNING_ALLOWED']='NO';config.build_settings['GENERATE_INFOPLIST_FILE']='YES';config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.nagamealert.productprobe.'+target.name;config.build_settings['TARGETED_DEVICE_FAMILY']='1'
 end
end
tests.build_configurations.each { |c| c.build_settings['TEST_TARGET_NAME']='Harness' };project.save
scheme=Xcodeproj::XCScheme.new;scheme.add_build_target(app);scheme.add_build_target(tests);scheme.add_test_target(tests);scheme.set_launch_target(app);scheme.save_as(project.path,'ProductUI',true)
