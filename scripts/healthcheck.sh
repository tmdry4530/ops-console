#!/usr/bin/env sh
set -eu
node -e "fetch(process.env.APP_BASE_URL ? process.env.APP_BASE_URL + '/api/health' : 'http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
