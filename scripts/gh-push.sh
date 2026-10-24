#!/bin/bash
# Sube RutaViva a GitHub — Uso: ./scripts/gh-push.sh <tu-usuario> <nombre-repo> [public|private]
# Ejemplo: ./scripts/gh-push.sh miusuario rutaviva public
set -e

USER="${1:?Falta el usuario de GitHub: ./scripts/gh-push.sh <usuario> <repo> [public|private]}"
REPO="${2:?Falta el nombre del repo: ./scripts/gh-push.sh <usuario> <repo> [public|private]}"
VISIBILITY="${3:-public}"

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${USER}/${REPO}.git"
git branch -M main
echo "Subiendo a https://github.com/${USER}/${REPO} ..."
git push -u origin main
echo ""
echo "✓ Listo. Acciones en el repo (web):"
echo "  1. Crea el repo ANTES en https://github.com/new (sin README/.gitignore iniciales)"
echo "  2. Settings → Secrets and variables → Actions → New repository secret:"
echo "     CAP_SERVER_URL = https://<tu-app>.up.railway.app  (tras desplegar en Railway)"
echo "  3. Pestaña Actions → workflow 'Android AAB (RutaViva)' → Run workflow → descarga el artefacto"
