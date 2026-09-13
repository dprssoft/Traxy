#!/usr/bin/env bash
set -e

# Ensure PATH has user local binaries and Android platform tools
export PATH="$HOME/.local/bin:$HOME/Android/Sdk/platform-tools:/usr/bin:/bin:$PATH"

TARGET_IP="192.168.0.195"

# If not running in a terminal, spawn gnome-terminal window so it can be interacted with
if [ ! -t 0 ] && [ -z "$SPAWNED_TERM" ]; then
    export SPAWNED_TERM=1
    if command -v gnome-terminal >/dev/null 2>&1; then
        exec gnome-terminal --geometry=65x12 --title="ADB Connect to Phone (${TARGET_IP})" -- bash "$0" "$@"
        exit 0
    elif command -v zenity >/dev/null 2>&1; then
        PORT=$(zenity --entry --title="ADB Connect" --text="Enter port for ${TARGET_IP}:" --entry-text="" --width=320)
        PORT=$(echo "$PORT" | xargs)
        if [ -n "$PORT" ]; then
            OUT=$(adb connect "${TARGET_IP}:${PORT}" 2>&1 || true)
            if command -v notify-send >/dev/null 2>&1; then
                notify-send -a "ADB" "ADB Connect" "$OUT"
            fi
        fi
        exit 0
    fi
fi

echo "=================================================="
echo "         ADB Connect to Remote Phone              "
echo "         Target IP: ${TARGET_IP}                  "
echo "=================================================="
echo ""
read -r -p "Enter port for ${TARGET_IP}: " PORT

# Trim whitespace
PORT=$(echo "$PORT" | xargs)

if [ -z "$PORT" ]; then
    echo "No port entered. Closing..."
    sleep 1
    exit 0
fi

echo ""
echo "Connecting to ${TARGET_IP}:${PORT}..."
OUT=$(adb connect "${TARGET_IP}:${PORT}" 2>&1 || true)
echo "$OUT"

if command -v notify-send >/dev/null 2>&1; then
    notify-send -a "ADB" "ADB Connect" "$OUT"
fi

if echo "$OUT" | grep -iq "failed"; then
    echo ""
    echo "⚠️  Connection failed. Closing window in 4 seconds..."
    sleep 4
else
    echo ""
    echo "✅ Connected! Closing window in 2 seconds..."
    sleep 2
fi

exit 0
