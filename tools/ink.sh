#!/usr/bin/env bash
set -euo pipefail
/Applications/Inkscape.app/Contents/MacOS/inkscape "$@" 2> >(grep -v -E 'CMSSystem::load_profiles|Gtk-CRITICAL|Gtk-WARNING' >&2)
