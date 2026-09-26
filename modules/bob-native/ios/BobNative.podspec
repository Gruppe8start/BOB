Pod::Spec.new do |s|
  s.name           = 'BobNative'
  s.version        = '0.1.0'
  s.summary        = 'Screen Time, DeviceActivity and AlarmKit bridge for BOB'
  s.description    = 'Screen Time authorization, distracting-app picker, usage monitoring and AlarmKit alarms.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'DeviceActivity', 'ManagedSettings', 'SwiftUI'
  s.weak_frameworks = 'AlarmKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
