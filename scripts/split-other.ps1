$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'assets\other.png'
$outDir = Join-Path $root 'assets\other'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Export-Pose($bmp, $name, $pose, $x, $y, $w, $h) {
    $out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($py = 0; $py -lt $h; $py++) {
        for ($px = 0; $px -lt $w; $px++) {
            $p = $bmp.GetPixel($x + $px, $y + $py)
            if ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235) { continue }
            [void]$out.SetPixel($px, $py, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
        }
    }
    $path = Join-Path $outDir "$name-$pose.png"
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Output $path
}

$bmp = [System.Drawing.Bitmap]::FromFile($src)
Write-Output "Source: $($bmp.Width)x$($bmp.Height)"

# other.png — 5행 × 4열 (대기·공격·방어·회피)
$chars = @(
    @{ id='bandit';       y=56;  h=194; }
    @{ id='thief';        y=271; h=178; }
    @{ id='swordsman_3';  y=458; h=203; }
    @{ id='swordsman_2';  y=672; h=202; }
    @{ id='swordsman_1';  y=884; h=214; }
)

$cols = @(
    @{ pose='idle';   x=180;  w=273; }
    @{ pose='attack'; x=454;  w=334; }
    @{ pose='defend'; x=789;  w=262; }
    @{ pose='evade';  x=1052; w=343; }
)

foreach ($ch in $chars) {
    foreach ($col in $cols) {
        Export-Pose $bmp $ch.id $col.pose $col.x $ch.y $col.w $ch.h
    }
}

$bmp.Dispose()
Write-Output 'Done.'