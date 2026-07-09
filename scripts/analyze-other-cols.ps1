$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\other.png'
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width

$rows = @(
    @{ id = 'bandit'; y = 56; h = 194 },
    @{ id = 'thief'; y = 271; h = 178 },
    @{ id = 'swordsman_3'; y = 458; h = 203 },
    @{ id = 'swordsman_2'; y = 672; h = 202 },
    @{ id = 'swordsman_1'; y = 884; h = 214 }
)

foreach ($row in $rows) {
    $colBand = @()
    for ($x = 0; $x -lt $w; $x++) {
        $c = 0
        for ($y = $row.y; $y -lt ($row.y + $row.h); $y += 2) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.R -le 235 -or $p.G -le 235 -or $p.B -le 235) { $c++ }
        }
        $colBand += $c
    }
    $cols = @(); $in = $false; $start = 0
    for ($x = 0; $x -lt $w; $x++) {
        $dense = $colBand[$x] -gt 12
        if ($dense -and -not $in) { $start = $x; $in = $true }
        elseif (-not $dense -and $in) {
            $cols += [pscustomobject]@{ x = $start; w = ($x - $start) }
            $in = $false
        }
    }
    if ($in) { $cols += [pscustomobject]@{ x = $start; w = ($w - $start) } }
    Write-Output "--- $($row.id) ---"
    $cols | ForEach-Object { Write-Output ("x={0} w={1}" -f $_.x, $_.w) }
}
$bmp.Dispose()