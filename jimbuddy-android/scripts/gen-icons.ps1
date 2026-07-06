Add-Type -AssemblyName System.Drawing

# Icon sizes: [folder, size_px]
$sizes = @(
    @{ folder = "mipmap-mdpi";    size = 48  },
    @{ folder = "mipmap-hdpi";    size = 72  },
    @{ folder = "mipmap-xhdpi";   size = 96  },
    @{ folder = "mipmap-xxhdpi";  size = 144 },
    @{ folder = "mipmap-xxxhdpi"; size = 192 }
)

$resBase = "d:\Programming Projects\web projects\gym\jimbuddy-android\android\app\src\main\res"

function Draw-DumbbellIcon($size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background: dark #0A0A0F with rounded corners
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 15))
    $radius  = [int]($size * 0.22)
    $rect    = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    # Draw rounded rect background
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rect.X, $rect.Y, $radius*2, $radius*2, 180, 90)
    $path.AddArc($rect.Right - $radius*2, $rect.Y, $radius*2, $radius*2, 270, 90)
    $path.AddArc($rect.Right - $radius*2, $rect.Bottom - $radius*2, $radius*2, $radius*2, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $radius*2, $radius*2, $radius*2, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)

    # Colors
    $teal      = [System.Drawing.Color]::FromArgb(255, 0, 229, 160)   # #00E5A0
    $tealLight = [System.Drawing.Color]::FromArgb(255, 0, 255, 178)   # #00FFB2
    $brushTeal      = New-Object System.Drawing.SolidBrush($teal)
    $brushTealLight = New-Object System.Drawing.SolidBrush($tealLight)

    # Scale factor: design is on 108px canvas, safe zone 72px centred
    # Dumbbell spans x=18..90, y=43..65 on 108 canvas -> map to $size
    $s = $size / 108.0

    function ScaledRect($x, $y, $w, $h) {
        return New-Object System.Drawing.RectangleF(($x*$s), ($y*$s), ($w*$s), ($h*$s))
    }

    # Bar: x=34..74, y=52..56
    $g.FillRectangle($brushTeal, (ScaledRect 34 52 40 4))

    # Left collar: x=24..32, y=47..61
    $g.FillRectangle($brushTeal, (ScaledRect 24 47 8 14))

    # Left plate: x=18..24, y=43..65
    $g.FillRectangle($brushTealLight, (ScaledRect 18 43 6 22))

    # Right collar: x=76..84, y=47..61
    $g.FillRectangle($brushTeal, (ScaledRect 76 47 8 14))

    # Right plate: x=84..90, y=43..65
    $g.FillRectangle($brushTealLight, (ScaledRect 84 43 6 22))

    $g.Dispose()
    return $bmp
}

foreach ($entry in $sizes) {
    $folder = $entry.folder
    $sz     = $entry.size

    $bmp = Draw-DumbbellIcon $sz

    # ic_launcher.png
    $out1 = "$resBase\$folder\ic_launcher.png"
    $bmp.Save($out1, [System.Drawing.Imaging.ImageFormat]::Png)

    # ic_launcher_round.png (same image, Android uses it for circular mask)
    $out2 = "$resBase\$folder\ic_launcher_round.png"
    $bmp.Save($out2, [System.Drawing.Imaging.ImageFormat]::Png)

    $bmp.Dispose()
    Write-Host "Generated $sz x $sz -> $folder"
}

Write-Host "All icons generated successfully."
