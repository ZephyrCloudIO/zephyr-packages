require "json"

begin
  react_native_pods = Pod::Executable.execute_command(
    "node",
    [
      "-p",
      'require.resolve("react-native/scripts/react_native_pods.rb", {paths: [process.argv[1]]})',
      __dir__,
    ],
  ).strip
  require react_native_pods
rescue StandardError
  # Keep podspec evaluation working even when React Native helpers are unavailable.
end

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
min_ios_version = if respond_to?(:min_ios_version_supported, true)
  min_ios_version_supported
else
  "13.4"
end
install_modules_dependencies_fn = if respond_to?(:install_modules_dependencies, true)
  method(:install_modules_dependencies)
end

Pod::Spec.new do |s|
  s.name         = "zephyr-native-cache"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/ZephyrCloudIO/zephyr-packages"
  s.license      = package["license"]
  s.authors      = "Zephyr Cloud Contributors"
  s.platforms    = { :ios => min_ios_version }
  s.source       = { :git => "https://github.com/ZephyrCloudIO/zephyr-packages.git", :tag => s.version }
  s.source_files = "ios/**/*.{h,m,mm,cpp}"

  if install_modules_dependencies_fn
    install_modules_dependencies_fn.call(s)
  else
    s.dependency "React-Core"
  end
end
