# Ingestão de conteúdo da Wiki interna (artigos/quiz/roleplays/módulos) a
# partir dos 4 JSON de origem em c:\VScode\Prema\Central\_fontes — chama a
# edge function wiki-ingest (upsert idempotente, seguro rodar de novo
# sempre que o conteúdo-fonte mudar).
#
# Uso:
#   1. Pegue a service_role key: npx supabase projects api-keys --project-ref qzvswhfjuxfebpvlbysd
#   2. $env:SUPABASE_SERVICE_ROLE_KEY = "<cole a key aqui>"
#   3. .\scripts\wiki-ingest.ps1

param(
  [string]$SourceDir = "c:\VScode\Prema\Central\_fontes",
  [string]$FunctionUrl = "https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/wiki-ingest"
)

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Error "Defina `$env:SUPABASE_SERVICE_ROLE_KEY primeiro (veja o uso no topo deste arquivo)."
  exit 1
}

$files = @("comercial", "institucional", "suporte", "cs")

foreach ($file in $files) {
  $path = Join-Path $SourceDir "$file.json"
  if (-not (Test-Path $path)) {
    Write-Warning "Arquivo não encontrado, pulando: $path"
    continue
  }

  Write-Host "Ingerindo $file..." -ForegroundColor Cyan
  $data = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json -Depth 30
  $body = @{ file = $file; data = $data } | ConvertTo-Json -Depth 30 -Compress

  try {
    $resp = Invoke-RestMethod -Method POST -Uri $FunctionUrl `
      -Headers @{ Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY" } `
      -ContentType "application/json; charset=utf-8" `
      -Body ([System.Text.Encoding]::UTF8.GetBytes($body))

    Write-Host ("  counts: articles={0} quiz={1} roleplays={2} modules={3}" -f `
      $resp.counts.articles, $resp.counts.quiz, $resp.counts.roleplays, $resp.counts.modules) -ForegroundColor Green
    if ($resp.warnings.Count -gt 0) {
      Write-Host "  warnings:" -ForegroundColor Yellow
      $resp.warnings | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
    }
  } catch {
    Write-Error "Falha ingerindo $file`: $_"
  }
}

Write-Host "Concluído." -ForegroundColor Cyan
