# Minimal fallback using the existing corrected xcodeproj scheme API.
# No private source, credentials or Swift package downloads.
require 'xcodeproj'
require 'fileutils'
FileUtils.mkdir_p('NeutralUI')
File.write('NeutralUI/Harness.swift', <<~SWIFT)
import UIKit
@main final class HarnessDelegate: UIResponder, UIApplicationDelegate {
 var window: UIWindow?
 func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey:Any]?) -> Bool {
  window=UIWindow(frame: UIScreen.main.bounds);window?.rootViewController=UIViewController();window?.makeKeyAndVisible();return true
 }
}
SWIFT
File.write('NeutralUI/NeutralUITests.swift', <<~SWIFT)
import XCTest
final class NeutralUITests: XCTestCase {
 var evidence: [String:Any] = ["xctestStarted":true,"safariForeground":false,"fixtureLoaded":false,"tapAttempted":false]
 let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
 func capture(_ name:String) {
  let shot=XCTAttachment(screenshot:safari.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)
 }
 func checkpoint(_ stage:String) {
  evidence["stage"]=stage
  evidence["dateMs"]=Int64(Date().timeIntervalSince1970*1000)
  evidence["testIdentifier"]="NeutralUITests/testNeutralTap()"
  if let data=try? JSONSerialization.data(withJSONObject:evidence,options:[.sortedKeys]) {
   let item=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");item.name="neutral-state-"+stage;item.lifetime = .keepAlways;add(item)
  }
  print("NEUTRAL_STAGE "+stage)
 }
 override func tearDownWithError() throws { capture("neutral-xctest-final");checkpoint("final") }
 func testNeutralTap() throws {
  continueAfterFailure=false
  checkpoint("test-entered")
  safari.activate()
  evidence["safariForeground"]=safari.wait(for:.runningForeground,timeout:10)
  capture("neutral-safari-foreground");checkpoint("safari-foreground")
  XCTAssertTrue(evidence["safariForeground"] as? Bool == true,"Safari not foreground")
  // First-launch Safari onboarding only; no product controls or synthetic input.
  for name in ["Continue","Not Now"] {
   let control=safari.buttons[name]
   if control.waitForExistence(timeout:2) && control.isHittable { control.tap() }
  }
  let address=safari.textFields.matching(NSPredicate(format:"identifier == %@ OR label CONTAINS[c] %@ OR label CONTAINS[c] %@","URL","Address","Search")).firstMatch
  capture("neutral-navigation-before");checkpoint("navigation-start")
  XCTAssertTrue(address.waitForExistence(timeout:8),"Safari native address field unavailable")
  address.tap()
  address.typeText("http://127.0.0.1:8765/control?route=xctest\\n")
  let web=safari.webViews.firstMatch
  let button=web.buttons["Neutral activation"]
  evidence["fixtureLoaded"]=button.waitForExistence(timeout:12) && web.staticTexts["Neutral input control"].exists
  capture("neutral-navigation-after");checkpoint("fixture-loaded")
  XCTAssertTrue(evidence["fixtureLoaded"] as? Bool == true,"Real neutral fixture not loaded")
  XCTAssertTrue(button.isHittable)
  XCTAssertTrue(web.staticTexts["Activations: 0"].exists)
  evidence["counterBefore"]=0;evidence["targetHittable"]=button.isHittable
  capture("neutral-xctest-before");checkpoint("before-tap")
  print("NEUTRAL_FRAME \\(button.frame)")
  evidence["tapAttempted"]=true;checkpoint("tap-call-entered")
  button.tap()
  evidence["tapReturned"]=true;checkpoint("tap-returned")
  let activated=web.staticTexts["Activations: 1"]
  let didActivate=activated.waitForExistence(timeout:8)
  if didActivate { evidence["counterAfter"]=1 }
  else if web.staticTexts["Activations: 0"].exists { evidence["counterAfter"]=0 }
  capture("neutral-xctest-after");checkpoint("after-tap")
  XCTAssertTrue(didActivate,"Neutral counter did not change after one XCUIElement tap")
  print("NEUTRAL_ACTIVATION_VERIFIED")
 }
}
SWIFT
project=Xcodeproj::Project.new('NeutralUI/NeutralUI.xcodeproj')
app=project.new_target(:application,'Harness',:ios,'18.5')
tests=project.new_target(:ui_test_bundle,'NeutralUITests',:ios,'18.5')
app.add_file_references([project.main_group.new_file('Harness.swift')])
tests.add_file_references([project.main_group.new_file('NeutralUITests.swift')])
tests.add_dependency(app)
[app,tests].each do |target|
 target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['CODE_SIGNING_ALLOWED']='NO'
  config.build_settings['GENERATE_INFOPLIST_FILE']='YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.nagamealert.neutral.'+target.name
  config.build_settings['TARGETED_DEVICE_FAMILY']='1'
 end
end
tests.build_configurations.each { |c| c.build_settings['TEST_TARGET_NAME']='Harness' }
project.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(app);scheme.add_build_target(tests);scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(project.path,'NeutralUI',true)
