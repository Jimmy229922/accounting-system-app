###############################################################################
#  backup.ps1 - أداة النسخ الاحتياطي المستقلة
#  تعمل بشكل منفصل تماماً عن البرنامج
#  تنسخ قاعدة البيانات من مسار التطبيق إلى مجلد Data و PIC
###############################################################################

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir       = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDir       = Join-Path $baseDir 'Data'
$backupRootDir = Join-Path $baseDir 'PIC'

# المسارات المحتملة لقاعدة البيانات داخل %APPDATA%
$userDataDirs = @(
    (Join-Path $env:APPDATA 'accounting-system-desktop'),
    (Join-Path $env:APPDATA 'Accounting System'),
    (Join-Path $env:APPDATA 'accounting-system')
)

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '   أداة النسخ الاحتياطي - نظام المحاسبة' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# البحث عن قاعدة البيانات الحالية
$sourceDb = $null
foreach ($dir in $userDataDirs) {
    $candidate = Join-Path $dir 'accounting.db'
    if (Test-Path $candidate) {
        $sourceDb = $candidate
        break
    }
}

if (-not $sourceDb) {
    Write-Host '[خطأ] لم يتم العثور على قاعدة البيانات!' -ForegroundColor Red
    Write-Host ''
    Write-Host 'المسارات التي تم البحث فيها:' -ForegroundColor Yellow
    foreach ($dir in $userDataDirs) {
        Write-Host "  - $dir" -ForegroundColor Yellow
    }
    Write-Host ''
    Write-Host 'تأكد أن البرنامج تم تشغيله مرة واحدة على الأقل.' -ForegroundColor Yellow
    Read-Host 'اضغط Enter للخروج'
    exit 1
}

$fileSize = (Get-Item $sourceDb).Length
$fileSizeMB = [math]::Round($fileSize / 1MB, 2)

Write-Host "[1/3] تم العثور على قاعدة البيانات" -ForegroundColor Green
Write-Host "      المسار: $sourceDb" -ForegroundColor Gray
Write-Host "      الحجم:  $fileSizeMB MB" -ForegroundColor Gray
Write-Host ''

# إنشاء مجلدات النسخ الاحتياطي
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
New-Item -ItemType Directory -Path $backupRootDir -Force | Out-Null

# حفظ نسخة في مجلد Data (مثل النسخة التلقائية عند إغلاق البرنامج)
$dataBackupPath = Join-Path $dataDir 'accounting-auto-backup.db'

# اسم الملف مع التاريخ والوقت في PIC
$timestamp  = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$backupName = "accounting-backup-$timestamp.db"
$backupPath = Join-Path $backupRootDir $backupName

# نسخة بدون تاريخ (آخر نسخة دائماً) في PIC
$latestPath = Join-Path $backupRootDir 'accounting-latest-backup.db'

Write-Host '[2/3] جاري إنشاء النسخة الاحتياطية...' -ForegroundColor Cyan

try {
    Copy-Item -Path $sourceDb -Destination $dataBackupPath -Force
    Copy-Item -Path $sourceDb -Destination $backupPath -Force
    Copy-Item -Path $sourceDb -Destination $latestPath -Force
} catch {
    Write-Host "[خطأ] فشل نسخ الملف: $_" -ForegroundColor Red
    Write-Host ''
    Write-Host 'تأكد أن البرنامج مغلق ثم حاول مرة أخرى.' -ForegroundColor Yellow
    Read-Host 'اضغط Enter للخروج'
    exit 1
}

Write-Host '[3/3] تم بنجاح!' -ForegroundColor Green
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '   تم إنشاء النسخة الاحتياطية بنجاح!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "Data (تلقائي):  $dataBackupPath" -ForegroundColor Gray
Write-Host "النسخة المؤرخة:  $backupPath" -ForegroundColor Gray
Write-Host "آخر نسخة:       $latestPath" -ForegroundColor Gray
Write-Host ''
Write-Host 'يمكنك الآن حذف البرنامج وتنزيل النسخة الجديدة بأمان.' -ForegroundColor Yellow
Write-Host 'بعد تنزيل النسخة الجديدة، شغّل أداة الاستعادة (restore.cmd).' -ForegroundColor Yellow
Write-Host ''
Read-Host 'اضغط Enter للخروج'
