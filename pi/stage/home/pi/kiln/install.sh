#!/bin/bash

# Run this script on the Raspberry Pi to install system files.
# Usage: sudo ./install.sh

if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit
fi

echo "Installing system configuration..."

# Copy the contents of the etc folder to the system /etc
# -r: recursive
# -v: verbose
# -n: do not overwrite existing files (safer, remove -n to force overwrite)
cp -rv ./etc/* /etc/

# reload systemd to recognize the new file
systemctl daemon-reload

# enable the service to start on boot
systemctl enable kiln-controller.service

echo "Installation complete. You can start the service with: systemctl start kiln-controller"