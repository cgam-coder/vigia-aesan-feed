# Test-only project; no product source, broker or network client.
require 'xcodeproj'
require 'fileutils'
root=File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(root)
File.write(File.join(root,'Harness.swift'), <<~'SWIFT')
import UIKit
@main final class HarnessDelegate: UIResponder, UIApplicationDelegate {
 var window:UIWindow?
 func application(_ application:UIApplication,didFinishLaunchingWithOptions options:[UIApplication.LaunchOptionsKey:Any]?) -> Bool {
  window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=UIViewController();window?.makeKeyAndVisible();return true
 }
}
SWIFT
FileUtils.cp(File.join(__dir__,'PublicSafariTests.swift'),File.join(root,'PublicSafariTests.swift'))
project=Xcodeproj::Project.new(File.join(root,'PublicUI.xcodeproj'))
app=project.new_target(:application,'Harness',:ios,'18.5')
tests=project.new_target(:ui_test_bundle,'PublicSafariTests',:ios,'18.5')
app.add_file_references([project.main_group.new_file('Harness.swift')])
tests.add_file_references([project.main_group.new_file('PublicSafariTests.swift')])
tests.add_dependency(app)
[app,tests].each do |target|
 target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['CODE_SIGNING_ALLOWED']='NO'
  config.build_settings['GENERATE_INFOPLIST_FILE']='YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.nagamealert.publicui.'+target.name
  config.build_settings['TARGETED_DEVICE_FAMILY']='1'
 end
end
tests.build_configurations.each { |c| c.build_settings['TEST_TARGET_NAME']='Harness' }
project.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(app);scheme.add_build_target(tests);scheme.add_test_target(tests)
scheme.set_launch_target(app);scheme.save_as(project.path,'PublicUI',true)
