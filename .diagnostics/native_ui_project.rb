# Generates a disposable test harness. No application source or signing credentials.
require 'xcodeproj'
require 'fileutils'
FileUtils.mkdir_p('NativeUI')
File.write('NativeUI/Harness.swift', <<~SWIFT)
import UIKit
@main final class HarnessDelegate: UIResponder, UIApplicationDelegate {
 var window: UIWindow?
 func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey:Any]?) -> Bool {
  window=UIWindow(frame: UIScreen.main.bounds); window?.rootViewController=UIViewController();window?.makeKeyAndVisible();return true
 }
}
SWIFT
File.write('NativeUI/NativeUITests.swift', <<~SWIFT)
import XCTest
final class NativeUITests: XCTestCase {
 let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
 func capture(_ name:String) { let a=XCTAttachment(screenshot:safari.screenshot());a.name=name;a.lifetime = .keepAlways;add(a) }
 override func setUpWithError() throws { continueAfterFailure=false;safari.activate();XCUIDevice.shared.orientation = .portrait }
 func test00NativeHeaderControls() throws {
  let reject=safari.buttons["Rechazar analítica"]
  if reject.waitForExistence(timeout:8) { reject.tap();XCTAssertFalse(reject.waitForExistence(timeout:2)) }
  let web=safari.webViews.firstMatch
  let dark=web.buttons["Activar modo oscuro"]
  XCTAssertTrue(dark.waitForExistence(timeout:8));dark.tap()
  let light=web.buttons["Activar modo claro"]
  XCTAssertTrue(light.waitForExistence(timeout:5));capture("native-ui-dark");light.tap()
  let menu=web.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Menú")).firstMatch
  XCTAssertTrue(menu.waitForExistence(timeout:5));menu.tap()
  XCTAssertTrue(web.links["Fuentes"].waitForExistence(timeout:5));capture("native-ui-menu");menu.tap()
 }
 func test01KeyboardSearch() throws {
  let reject=safari.buttons["Rechazar analítica"]
  if reject.waitForExistence(timeout:8) { reject.tap() }
  let web=safari.webViews.firstMatch
  XCTAssertTrue(web.waitForExistence(timeout:8))
  let input=web.searchFields.firstMatch.exists ? web.searchFields.firstMatch : web.textFields.firstMatch
  XCTAssertTrue(input.waitForExistence(timeout:8));input.tap()
  capture("native-keyboard")
  XCTAssertTrue(safari.keyboards.firstMatch.waitForExistence(timeout:5),"iOS software keyboard absent")
  input.typeText("cacahuete")
  let search=safari.keyboards.buttons["Search"]
  if search.exists { search.tap() } else { input.typeText("\\n") }
  let result=web.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@", "Advertencia para personas")).firstMatch
  XCTAssertTrue(result.waitForExistence(timeout:10),"Expected peanut alert absent after native keyboard search")
  capture("native-keyboard-results")
 }
 func test02OrientationBars() throws {
  XCUIDevice.shared.orientation = .landscapeLeft
  let web=safari.webViews.firstMatch
  let until=Date().addingTimeInterval(8)
  while web.frame.width<=web.frame.height && Date()<until { RunLoop.current.run(until:Date().addingTimeInterval(0.3)) }
  capture("native-landscape-bars")
  XCTAssertGreaterThan(web.frame.width,web.frame.height,"Native rotation did not expose landscape WebView")
  XCUIDevice.shared.orientation = .portrait
  web.swipeUp();capture("native-scroll-bars")
  web.swipeDown();capture("native-portrait-bars")
 }
 func test03PinchZoom() throws {
  let web=safari.webViews.firstMatch
  let heading=web.staticTexts["Resultados"]
  web.swipeDown()
  XCTAssertTrue(heading.waitForExistence(timeout:5))
  let before=heading.frame.width
  web.pinch(withScale:1.4,velocity:1)
  capture("native-pinch-zoom")
  XCTAssertGreaterThan(heading.frame.width,before*1.1,"Pinch did not measurably enlarge Results heading")
 }
}
SWIFT
project=Xcodeproj::Project.new('NativeUI/NativeUI.xcodeproj')
app=project.new_target(:application,'Harness',:ios,'18.5')
tests=project.new_target(:ui_test_bundle,'NativeUITests',:ios,'18.5')
app.add_file_references([project.main_group.new_file('Harness.swift')])
tests.add_file_references([project.main_group.new_file('NativeUITests.swift')])
tests.add_dependency(app)
[app,tests].each do |target|
 target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['CODE_SIGNING_ALLOWED']='NO'
  config.build_settings['GENERATE_INFOPLIST_FILE']='YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.nagamealert.diagnostic.'+target.name
  config.build_settings['TARGETED_DEVICE_FAMILY']='1'
 end
end
tests.build_configurations.each { |c| c.build_settings['TEST_TARGET_NAME']='Harness' }
project.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(app);scheme.add_build_target(tests);scheme.add_test_target(tests)
scheme.launch_action.runnable=Xcodeproj::XCScheme::BuildableProductRunnable.new(app)
scheme.save_as(project.path,'NativeUI',true)
