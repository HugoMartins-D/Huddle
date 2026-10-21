# Sobe o HUDDLE para teste local: servidor de vídeo (LiveKit) + app (Vite).
# Uso: clique com o botão direito > "Executar com o PowerShell", ou rode .\iniciar-local.ps1
$ErrorActionPreference = "Stop"

# O Vite não roda direto por caminho de rede (\\SERVIDOR); usamos uma unidade mapeada.
$share = "\\SERVIDOR\ZimaOS-HD"
$drive = "Y:"
if (-not (Test-Path "$drive\")) {
  net use $drive $share /persistent:no | Out-Null
}
$project = "$drive\CODE LESS\PROJETOS\HUDDLE"

# Servidor de vídeo (modo desenvolvimento: chave devkey / segredo secret)
$livekit = "$env:LOCALAPPDATA\livekit\livekit-server.exe"
if (-not (Test-Path $livekit)) {
  Write-Host "LiveKit não encontrado em $livekit. Baixe em https://github.com/livekit/livekit/releases" -ForegroundColor Yellow
} elseif (-not (Get-NetTCPConnection -LocalPort 7880 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $livekit -ArgumentList "--dev", "--bind", "0.0.0.0" -WindowStyle Minimized
}

Write-Host "App: http://127.0.0.1:5174/  (Ctrl+C para parar)" -ForegroundColor Green
Set-Location $project
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
