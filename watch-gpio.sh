#!/usr/bin/env bash
# Monitora GPIO in tempo reale sul Raspberry Pi.
# Uso: ./watch-gpio.sh
#      sudo ./watch-gpio.sh
set -euo pipefail

ENV_FILE="${PIECE_COUNTER_ENV:-/etc/piece-counter.env}"
GPIO_PIN="${GPIO_PIN:-10}"
GPIO_IDLE="${GPIO_IDLE:-high}"
RUN_USER="${SUDO_USER:-${USER:-koman}}"

if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

home_dir="$(getent passwd "$RUN_USER" | cut -d: -f6)"
[[ -n "$home_dir" ]] || { echo "Utente non trovato: $RUN_USER" >&2; exit 1; }

if [[ ! -d "$home_dir" || ! -w "$home_dir" ]]; then
    echo "Home non scrivibile: $home_dir" >&2
    echo "Esegui: sudo mkdir -p $home_dir && sudo chown $RUN_USER:$RUN_USER $home_dir && sudo chmod 700 $home_dir" >&2
    exit 1
fi

echo "GPIO ${GPIO_PIN} live (idle=${GPIO_IDLE}). Ctrl+C per uscire."
echo "1=HIGH, 0=LOW"
echo

if command -v gpioget >/dev/null 2>&1; then
    while true; do
        value="$(gpioget gpiochip0 "${GPIO_PIN}" 2>/dev/null || echo "?")"
        printf '\rGPIO %s = %s  ' "$GPIO_PIN" "$value"
        sleep 0.1
    done
fi

cd "$home_dir"
exec python3 - <<PY
import os, time
import RPi.GPIO as GPIO

pin = int("${GPIO_PIN}")
idle = "${GPIO_IDLE}".lower()
pull = GPIO.PUD_DOWN if idle == "low" else GPIO.PUD_UP

GPIO.setwarnings(False)
GPIO.cleanup()
GPIO.setmode(GPIO.BCM)
GPIO.setup(pin, GPIO.IN, pull_up_down=pull)

print(f"gpioget non trovato, uso Python (idle={idle})")
try:
    while True:
        value = GPIO.input(pin)
        label = "HIGH" if value else "LOW"
        print(f"\rGPIO {pin} = {value} ({label})  ", end="", flush=True)
        time.sleep(0.1)
finally:
    GPIO.cleanup()
PY
