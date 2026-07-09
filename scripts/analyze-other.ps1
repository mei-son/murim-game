$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\other.png'
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width; $h = $bmp.Height
Write-Output "Size: ${w}x${h}"

$band = @()
for ($y = 0; $y -lt $h; $y++) {
    $c = 0
    for ($x = 0; $x -lt $w; $x += 3) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -le 235 -or $p.G -le 235 -or $p.B -le 235) { $c++ }
    }
    $band += $c
}

$blocks = @()
$in = $false; $start = 0
for ($y = 0; $y -lt $h; $y++) {
    $dense = $band[$y] -gt 15
    if ($dense -and -not $in) { $start = $y; $in = $true }
    elseif (-not $dense -and $in) {
        $blocks += [pscustomobject]@{ y = $start; h = ($y - $start) }
        $in = $false
    }
}
if ($in) { $blocks += [pscustomobject]@{ y = $start; h = ($h - $start) } }

Write-Output '--- rows ---'
$blocks | ForEach-Object { Write-Output ("y={0} h={1}" -f $_.y, $_.h) }

$charRow = ($blocks | Where-Object { $_.h -gt 100 } | Select-Object -First 1).y
$colBand = @()
for ($x = 0; $x -lt $w; $x++) {
    $c = 0
    for ($y = $charRow; $y -lt [Math]::Min($charRow + 220, $h); $y += 2) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -le 235 -or $p.G -le 235 -or $p.B -le 235) { $c++ }
    }
    $colBand += $c
}

$cols = @(); $in = $false; $start = 0
for ($x = 0; $x -lt $w; $x++) {
    $dense = $colBand[$x] -gt 8
    if ($dense -and -not $in) { $start = $x; $in = $true }
    elseif (-not $dense -and $in) {
        $cols += [pscustomobject]@{ x = $start; w = ($x - $start) }
        $in = $false
    }
}
if ($in) { $cols += [pscustomobject]@{ x = $start; w = ($w - $start) } }

Write-Output '--- cols ---'
$cols | ForEach-Object { Write-Output ("x={0} w={1}" -f $_.x, $_.w) }
$bmp.Dispose()