!macro customInstall
  WriteRegStr HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "DisplayName" "ZL Multi Manager"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "IconUri" "$INSTDIR\icon.ico"
  WriteRegDWORD HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "ShowInSettings" 1
!macroend
!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\ZL.MultiManager"
!macroend
