# Sobe o HUDDLE para teste local: servidor de vídeo (LiveKit) + app (Vite).
# Uso: clique com o botão direito > "Executar com o PowerShell", ou rode .\iniciar-local.ps1
$ErrorActionPreference = "Stop"

# O projeto é a pasta deste script. O Vite não roda direto por caminho de rede
# (\\maquina\compartilhamento\...); nesse caso mapeamos o compartilhamento numa unidade.
$project = $PSScriptRoot
if ($project -match '^(\\\\[^\\]+\\[^\\]+)(.*)$') {
  $share = $Matches[1]
  $rest = $Matches[2]
  $drive = "Y:"
  if (-not (Test-Path "$drive\")) {
    net use $drive $share /persistent:no | Out-Null
  }
  $project = "$drive$rest"
}

# Servidor de vídeo (modo desenvolvimento: chave devkey / segredo secret)
$livekit = "$env:LOCALAPPDATA\livekit\livekit-server.exe"
if (-not (Test-Path $livekit)) {
  Write-Host "LiveKit não encontrado em $livekit. Baixe em https://github.com/livekit/livekit/releases" -ForegroundColor Yellow
} elseif (-not (Get-NetTCPConnection -LocalPort 7880 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $livekit -ArgumentList "--dev", "--bind", "127.0.0.1" -WindowStyle Minimized
}

Write-Host "App: http://127.0.0.1:5174/  (Ctrl+C para parar)" -ForegroundColor Green
Set-Location $project
# Credenciais do LiveKit em modo --dev (só para teste local; em produção use chave e segredo próprios)
$env:LIVEKIT_API_KEY = "devkey"
$env:LIVEKIT_API_SECRET = "secret"
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
