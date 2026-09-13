#!/usr/bin/env bash
set -e

# Paths
PROJECT_ROOT="/home/yni/Projects/Traxy"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
ANDROID_DIR="${FRONTEND_DIR}/android"
APK_PATH="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
TARGET_IP="192.168.0.195"

export PATH="$HOME/.local/bin:$HOME/Android/Sdk/platform-tools:/usr/bin:/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"

# Spawn terminal if run from GUI / Desktop without terminal
if [ ! -t 0 ] && [ -z "$SPAWNED_TERM" ]; then
    export SPAWNED_TERM=1
    if command -v gnome-terminal >/dev/null 2>&1; then
        exec gnome-terminal --geometry=95x26 --title="Traxy - Android Build & Remote Install" -- bash "$0" "$@"
        exit 0
    fi
fi

echo "=================================================="
echo "       Traxy - Android Build & ADB Install        "
echo "=================================================="
echo ""

# Check device connection before building
echo "🔍 Checking connected ADB devices..."
adb devices
echo ""

REMOTE_DEVICE=$(adb devices | grep "${TARGET_IP}:" | grep "device$" | awk '{print $1}' | head -n 1)

if [ -z "$REMOTE_DEVICE" ]; then
    # Check if there is any other device
    ANY_DEVICE=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -n 1)
    if [ -n "$ANY_DEVICE" ]; then
        echo "Found connected device: ${ANY_DEVICE}"
        TARGET_DEVICE="$ANY_DEVICE"
    else
        echo "⚠️  Remote phone (${TARGET_IP}) is not currently connected."
        read -r -p "Enter wireless port to connect now (or press Enter to build only): " PORT
        PORT=$(echo "$PORT" | xargs)
        if [ -n "$PORT" ]; then
            echo "Connecting to ${TARGET_IP}:${PORT}..."
            adb connect "${TARGET_IP}:${PORT}" || true
            sleep 1
            REMOTE_DEVICE=$(adb devices | grep "${TARGET_IP}:" | grep "device$" | awk '{print $1}' | head -n 1)
            TARGET_DEVICE="$REMOTE_DEVICE"
        fi
    fi
else
    echo "✅ Found remote phone at: ${REMOTE_DEVICE}"
    TARGET_DEVICE="$REMOTE_DEVICE"
fi

echo ""
echo "📦 Step 1/3: Building web frontend (pnpm build)..."
cd "${FRONTEND_DIR}"
pnpm build

echo ""
echo "🔄 Step 2/3: Syncing Capacitor Android assets..."
pnpm exec cap sync android

echo ""
echo "⚙️  Step 3/3: Compiling Android APK (assembleDebug)..."
cd "${ANDROID_DIR}"
./gradlew assembleDebug

if [ ! -f "${APK_PATH}" ]; then
    echo "❌ Error: APK not found at ${APK_PATH}"
    echo ""
    read -r -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo "APK: ${APK_PATH}"
echo ""

# Refresh target device in case it connected while compiling
if [ -z "$TARGET_DEVICE" ]; then
    TARGET_DEVICE=$(adb devices | grep "${TARGET_IP}:" | grep "device$" | awk '{print $1}' | head -n 1)
    if [ -z "$TARGET_DEVICE" ]; then
        TARGET_DEVICE=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -n 1)
    fi
fi

if [ -n "$TARGET_DEVICE" ]; then
    echo "📲 Installing APK to device (${TARGET_DEVICE})..."
    adb -s "$TARGET_DEVICE" install -r "${APK_PATH}"
    echo ""
    echo "🚀 Launching Track List on device..."
    adb -s "$TARGET_DEVICE" shell monkey -p com.yourname.tracklist -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
    echo "✅ Installation complete!"
    if command -v notify-send >/dev/null 2>&1; then
        notify-send -a "Traxy" "Android Build & Install" "Successfully installed and launched on ${TARGET_DEVICE}"
    fi
else
    echo "⚠️  No ADB device connected. APK built successfully, but not installed."
    echo "Run the ADB Connect script, then install with: adb install -r ${APK_PATH}"
fi

echo ""
echo "=================================================="
read -r -p "All done! Press Enter to close this window..."
exit 0
