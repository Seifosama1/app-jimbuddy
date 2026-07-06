$adb = "d:\Programming Projects\web projects\gym\jimbuddy-android\.android-sdk\platform-tools\adb.exe"
$apk = "d:\Programming Projects\web projects\gym\jimbuddy-android\releases\JimBuddy.apk"
Write-Host "Installing APK..."
& $adb install -r $apk
Write-Host "Done."
