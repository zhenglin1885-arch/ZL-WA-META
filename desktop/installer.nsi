Unicode true
!include "MUI2.nsh"
Name "ZL Multi Manager"
OutFile "release/ZL-Multi-Manager-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\ZL Multi Manager"
InstallDirRegKey HKCU "Software\ZL Multi Manager" "InstallDir"
RequestExecutionLevel user
SetCompressor zlib
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\ZL Multi Manager.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开 ZL Multi Manager"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
!macro CloseZL PREFIX
Function ${PREFIX}CloseZL
  IfFileExists "$INSTDIR\ZL Multi Manager.exe" 0 done
  ExecWait '"$INSTDIR\ZL Multi Manager.exe" --quit-for-maintenance'
  StrCpy $1 0
  waitclose:
    ClearErrors
    FileOpen $0 "$INSTDIR\ZL Multi Manager.exe" a
    IfErrors stillrunning
    FileClose $0
    Goto done
  stillrunning:
    IntOp $1 $1 + 1
    IntCmp $1 30 askclose 0 askclose
    Sleep 200
    Goto waitclose
  askclose:
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请从系统托盘完全退出 ZL Multi Manager 后重试。" IDRETRY resetwait
    Abort
  resetwait:
    StrCpy $1 0
    Goto waitclose
  done:
FunctionEnd
!macroend
!insertmacro CloseZL ""
!insertmacro CloseZL "un."
Section "Install"
  Call CloseZL
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r /x ".*" "release/win-unpacked/*.*"
  File "icon.ico"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "DisplayName" "ZL Multi Manager"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "IconUri" "$INSTDIR\icon.ico"
  WriteRegDWORD HKCU "Software\Classes\AppUserModelId\ZL.MultiManager" "ShowInSettings" 1
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\ZL Multi Manager.lnk" "$INSTDIR\ZL Multi Manager.exe"
  CreateDirectory "$SMPROGRAMS\ZL Multi Manager"
  CreateShortcut "$SMPROGRAMS\ZL Multi Manager\ZL Multi Manager.lnk" "$INSTDIR\ZL Multi Manager.exe"
  CreateShortcut "$SMPROGRAMS\ZL Multi Manager\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\ZL Multi Manager" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZLMultiManager" "DisplayName" "ZL Multi Manager"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZLMultiManager" "DisplayVersion" "0.2.0-R10"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZLMultiManager" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZLMultiManager" "DisplayIcon" "$INSTDIR\ZL Multi Manager.exe"
SectionEnd
Section "Uninstall"
  Call un.CloseZL
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\ZL.MultiManager"
  Delete "$INSTDIR\icon.ico"
  SetShellVarContext current
  Delete "$DESKTOP\ZL Multi Manager.lnk"
  Delete "$SMPROGRAMS\ZL Multi Manager\ZL Multi Manager.lnk"
  Delete "$SMPROGRAMS\ZL Multi Manager\Uninstall.lnk"
  RMDir "$SMPROGRAMS\ZL Multi Manager"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZLMultiManager"
  DeleteRegKey HKCU "Software\ZL Multi Manager"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ZL Multi Manager"
  ; Remove only shipped program files; preserve user data and unrelated directory contents.
  !include "uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
