# Requires: drag a character folder onto push-mage.cmd
# Or: powershell -File push-mage.ps1 "D:\...\法师1新"
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location -LiteralPath $PSScriptRoot
$log = Join-Path $PSScriptRoot "mage-push-log.txt"
function Log([string]$msg) {
  Add-Content -LiteralPath $log -Value $msg -Encoding UTF8
  Write-Host $msg
}

"==== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====" | Set-Content -LiteralPath $log -Encoding UTF8

$src = $null
if ($args.Count -ge 1 -and $args[0]) {
  $src = [string]$args[0]
} elseif (Test-Path -LiteralPath (Join-Path $PSScriptRoot "mage-src.txt")) {
  $src = (Get-Content -LiteralPath (Join-Path $PSScriptRoot "mage-src.txt") -Encoding UTF8 -TotalCount 1).Trim()
}

if (-not $src) {
  Log "FAIL: no source folder."
  Log "Drag the character folder onto push-mage.cmd"
  Log "Or put one path line into mage-src.txt"
  exit 1
}

$src = $src.Trim().Trim('"')
Log "Source: $src"

if (-not (Test-Path -LiteralPath $src -PathType Container)) {
  Log "FAIL: folder not found: $src"
  exit 1
}

function Find-ActionDir([string]$root, [string[]]$names) {
  foreach ($n in $names) {
    $p = Join-Path $root $n
    if (Test-Path -LiteralPath $p -PathType Container) { return $p }
  }
  return $null
}

$walk = Find-ActionDir $src @("走路", "walking", "walk")
$atk = Find-ActionDir $src @("攻击", "attack")
$die = Find-ActionDir $src @("死亡", "death")
$idle = Find-ActionDir $src @("待机", "idle", "stand")

if (-not $walk) {
  Log "FAIL: no 走路/walking under source. Children:"
  Get-ChildItem -LiteralPath $src -Directory | ForEach-Object { Log ("  " + $_.Name) }
  exit 1
}

$dstRoot = Join-Path $PSScriptRoot "public\sprites\inbox\base_animations"
$map = @{
  walking = $walk
  attack  = $atk
  death   = $die
  idle    = $idle
}

foreach ($key in @("walking", "attack", "death", "idle")) {
  $from = $map[$key]
  if (-not $from) { continue }
  $to = Join-Path $dstRoot $key
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Get-ChildItem -LiteralPath $to -File -Include *.png,*.webp,*.jpg,*.jpeg -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
  $files = Get-ChildItem -LiteralPath $from -File | Where-Object { $_.Extension -match '\.(png|webp|jpe?g)$' }
  Log ("Copy $($files.Count) files: $from -> $to")
  foreach ($f in $files) {
    # 00.png -> 0.png
    $m = [regex]::Match($f.Name, '(\d+)\.(png|webp|jpe?g)$', 'IgnoreCase')
    $destName = if ($m.Success) { "{0}.{1}" -f ([int]$m.Groups[1].Value), $m.Groups[2].Value.ToLower() } else { $f.Name.ToLower() }
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $to $destName) -Force
  }
}

$walkOut = Join-Path $dstRoot "walking"
$walkCount = @(Get-ChildItem -LiteralPath $walkOut -Filter *.png -ErrorAction SilentlyContinue).Count
Log "walking png count: $walkCount"
if ($walkCount -lt 1) {
  Log "FAIL: no png copied into walking"
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Log "FAIL: git not found"
  exit 1
}

& git add -- "public/sprites/inbox/base_animations"
if ($LASTEXITCODE -ne 0) { Log "FAIL: git add"; exit 1 }

$status = & git status --porcelain -- "public/sprites/inbox/base_animations"
Log "git status:"
Log $status
if (-not $status) {
  Log "FAIL: nothing new to commit"
  exit 1
}

& git commit -m "Update female mage base animations from studio pack."
if ($LASTEXITCODE -ne 0) { Log "FAIL: git commit"; exit 1 }

& git push
if ($LASTEXITCODE -ne 0) { Log "FAIL: git push"; exit 1 }

Log "OK. Tell agent: tu fang hao le"
exit 0
