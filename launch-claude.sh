#!/bin/bash

# Переходим в нужную директорию
cd ~/Documents/GitHub/ai_admin_v2.nosync

# Открываем VS Code в этой директории
code .

# Ждем, пока VS Code откроется
sleep 2

# Открываем терминал в VS Code и запускаем команду
osascript <<EOF
tell application "Visual Studio Code"
    activate
end tell

tell application "System Events"
    -- Открываем терминал (Ctrl+`)
    keystroke "\`" using {control down}
    delay 1

    -- Создаем новый терминал (Cmd+Shift+5 или через меню)
    keystroke "5" using {command down, shift down}
    delay 1

    -- Вводим команду
    keystroke "claude --dangerously-skip-permissions"
    delay 0.5

    -- Нажимаем Enter
    key code 36
end tell
EOF
