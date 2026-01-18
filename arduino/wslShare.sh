#
# Attach or detacth WSL shared USB port using the usbipd service
# Usage: wslShare.sh [on|off|list] [busid]
# Mounts or unmounts the shared USB drive in WSL
#

#!/bin/bash

# List the available USB devices with:
#   usbipd list | grep USB
# Then extract the busid of the desired device to share.

export USB_DEVICES=$(usbipd list | grep USB)
# Extract the busid of the first USB device found
USB_BUSID=$(echo "$USB_DEVICES" | head -n 1 | awk '{print $1}')

# use the optional PORT argument if provided or a default value
PORT=${2:-$USB_BUSID}
echo "Using busid: $PORT"
if [ "$1" == "on" ]; then
    # try the bind command first to ensure the device is available
    usbipd bind --busid $PORT
    usbipd attach --wsl --busid $PORT
    echo "WSL USB sharing enabled."
elif [ "$1" == "off" ]; then
    usbipd detach --busid $PORT
    echo "WSL USB sharing disabled."
elif [ "$1" == "list" ]; then
    usbipd list | grep USB
else
    echo "Usage: wslShare.sh [on|off|list] [busid]"
    exit 1
fi