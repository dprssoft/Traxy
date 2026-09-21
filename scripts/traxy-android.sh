#!/usr/bin/env bash
# Traxy Android helper: connect/pair phone over wireless ADB, then build & install.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APP_ID="com.yourname.tracklist"
PHONE_IP="192.168.0.195"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
JDK21="$(ls -d "$HOME"/.local/jdk/jdk-21* 2>/dev/null | head -n 1)"
[ -n "$JDK21" ] && export JAVA_HOME="$JDK21"
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$HOME/.local/bin:$PATH"

if command -v pnpm >/dev/null 2>&1; then PNPM=(pnpm); else PNPM=(npx -y pnpm@11); fi

pause() { read -r -p "Press Enter to continue..." _; }

device_serial() {
	adb devices | awk -v ip="$PHONE_IP:" 'index($1, ip) && $2 == "device" { print $1; exit }'
}

connect_phone() {
	echo "=================================================="
	echo "          Traxy - Connect phone (wireless ADB)     "
	echo "=================================================="
	echo "Phone: $PHONE_IP"
	echo "(Settings > Developer options > Wireless debugging)"
	echo ""
	read -r -p "Connection port (IP address & Port screen): " PORT
	PORT="$(echo "$PORT" | xargs)"
	[ -z "$PORT" ] && return 1

	local out
	out="$(adb connect "$PHONE_IP:$PORT" 2>&1)"
	echo "$out"
	if [ -n "$(device_serial)" ]; then
		echo "✅ Connected."
		return 0
	fi

	echo ""
	echo "Not connected - the laptop probably isn't paired yet."
	echo "On the phone tap 'Pair device with pairing code'."
	read -r -p "Pairing port (or Enter to skip): " PAIR_PORT
	PAIR_PORT="$(echo "$PAIR_PORT" | xargs)"
	[ -z "$PAIR_PORT" ] && return 1
	read -r -p "Pairing code: " CODE
	CODE="$(echo "$CODE" | xargs)"
	adb pair "$PHONE_IP:$PAIR_PORT" "$CODE" || return 1

	adb connect "$PHONE_IP:$PORT"
	if [ -n "$(device_serial)" ]; then
		echo "✅ Paired and connected."
		return 0
	fi
	echo "❌ Paired, but connecting to port $PORT failed."
	echo "   The connection port is on the main Wireless debugging screen, not the pairing dialog."
	return 1
}

build_and_install() {
	local serial
	serial="$(device_serial)"
	if [ -z "$serial" ]; then
		echo "❌ Phone is not connected."
		return 1
	fi

	cd "$FRONTEND_DIR" || return 1
	echo ""
	echo "📦 1/3 Building web app..."
	"${PNPM[@]}" build || return 1
	echo ""
	echo "🔄 2/3 Syncing Capacitor..."
	"${PNPM[@]}" exec cap sync android || return 1
	echo ""
	echo "⚙️  3/3 Compiling APK..."
	(cd "$ANDROID_DIR" && ./gradlew assembleDebug) || return 1
	[ -f "$APK_PATH" ] || { echo "❌ APK not found: $APK_PATH"; return 1; }

	echo ""
	echo "📲 Installing on $serial..."
	if ! adb -s "$serial" install -r "$APK_PATH"; then
		echo ""
		echo "❌ Install failed. If it says INSTALL_FAILED_USER_RESTRICTED, allow"
		echo "   'Install via USB' in Developer options and confirm the prompt on the phone."
		echo "   If it says signatures do not match, the old app must be uninstalled first"
		echo "   (this erases its data)."
		return 1
	fi
	adb -s "$serial" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
	echo "✅ Installed and launched."
}

connect_phone || echo "⚠️  Continuing without a connection."

while true; do
	echo ""
	echo "=================================================="
	echo "                    Traxy Android                 "
	echo "=================================================="
	if [ -n "$(device_serial)" ]; then echo "Phone: connected"; else echo "Phone: NOT connected"; fi
	echo ""
	echo "  1. Build and install"
	echo "  0. Exit"
	echo ""
	read -r -p "Choose: " CHOICE
	case "$CHOICE" in
		1) build_and_install; pause ;;
		0) exit 0 ;;
		*) echo "Unknown option." ;;
	esac
done
