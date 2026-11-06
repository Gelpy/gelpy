#!/usr/bin/env bash
# Installs the pinned supply-chain scanners for the Workers Builds PR build (ADR-0018, Work Item
# 003-025, from the gelpy-web pilot 003-019): gitleaks, by version, verified against
# security/tools.sha256 before use (the same file and hash as gelpy-web). sha256sum --strict
# fails on any missing or mismatched file, and then nothing is extracted.
# Usage: scripts/install-scanners.sh <bin-dir>
set -euo pipefail

GITLEAKS_VERSION="8.30.0"
root="$(cd "$(dirname "$0")/.." && pwd)"
bin="${1:?usage: install-scanners.sh <bin-dir>}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$bin"
# Absolute before the cd below: a relative <bin-dir> would otherwise resolve inside $work.
bin="$(cd "$bin" && pwd)"
cd "$work"
gitleaks="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
curl --proto "=https" --tlsv1.2 -fsSLO "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${gitleaks}"
sha256sum --strict -c "$root/security/tools.sha256"
tar -xzf "$gitleaks" -C "$bin" gitleaks
"$bin/gitleaks" version
