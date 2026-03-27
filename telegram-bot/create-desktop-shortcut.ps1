# Создаёт ярлык на рабочем столе: двойной щелёк запускает start-bot.bat из этой папки.
$botDir = $PSScriptRoot
$desk = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $botDir 'start-bot.bat'
$lnkPath = Join-Path $desk 'Запуск бота ЛФК.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $botDir
$shortcut.Description = 'Telegram-бот записи на приём'
$shortcut.Save()

Write-Host "Ярлык создан: $lnkPath"
