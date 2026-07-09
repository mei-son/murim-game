# hero-motions.png → hero-{idle,attack,defend,evade}.png
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'assets\hero-motions.png'
$outDir = Join-Path $root 'assets'
if (-not (Test-Path $src)) { Write-Error "Missing $src"; exit 1 }

Add-Type -AssemblyName System.Drawing
function Export-Pose($bmp, $pose, $x, $y, $w, $h) {
    $out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($py = 0; $py -lt $h; $py++) {
        for ($px = 0; $px -lt $w; $px++) {
            $p = $bmp.GetPixel($x + $px, $y + $py)
            if ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235) { continue }
            [void]$out.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
        }
    }
    $path = Join-Path $outDir "hero-$pose.png"
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Output $path
}

$bmp = [System.Drawing.Bitmap]::FromFile($src)
Export-Pose $bmp 'idle'   0    0 725 542
Export-Pose $bmp 'attack' 725  0 726 542
Export-Pose $bmp 'defend' 0  542 725 542
Export-Pose $bmp 'evade'  725 542 726 542
$bmp.Dispose()
Write-Output 'Done.'