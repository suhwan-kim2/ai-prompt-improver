#!/usr/bin/env bash
# 더블클릭 또는 ./start.sh 로 실행. 처음이면 필요한 것부터 설치한다.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 설치되어 있지 않습니다."
  echo "https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요."
  read -r -p "엔터를 누르면 닫힙니다..." _
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "처음 실행이라 필요한 것을 설치합니다. 몇 분 걸립니다..."
  npm install || { echo "설치에 실패했습니다."; read -r -p "엔터..." _; exit 1; }
fi

node src/index.js go
read -r -p "엔터를 누르면 닫힙니다..." _
