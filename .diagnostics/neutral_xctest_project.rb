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
 func testNeutralTap() throws {
  continueAfterFailure=false
  let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
  safari.activate()
  let web=safari.webViews.firstMatch
  let button=web.buttons["Neutral activation"]
  XCTAssertTrue(button.waitForExistence(timeout:10))
  XCTAssertTrue(button.isHittable)
  XCTAssertTrue(web.staticTexts["Activations: 0"].exists)
  let before=XCTAttachment(screenshot:safari.screenshot());before.name="neutral-xctest-before";before.lifetime = .keepAlways;add(before)
  print("NEUTRAL_FRAME \\(button.frame)")
  button.tap()
  let activated=web.staticTexts["Activations: 1"]
  let didActivate=activated.waitForExistence(timeout:8)
  let after=XCTAttachment(screenshot:safari.screenshot());after.name="neutral-xctest-after";after.lifetime = .keepAlways;add(after)
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
