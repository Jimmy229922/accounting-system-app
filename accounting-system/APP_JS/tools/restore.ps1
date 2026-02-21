###############################################################################
#  restore.ps1 - أداة استعادة النسخة الاحتياطية المستقلة
#  تعمل بشكل منفصل تماماً عن البرنامج
#  تستعيد قاعدة البيانات من مجلد PIC إلى مسار التطبيق
###############################################################################

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir       = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backupRootDir = Join-Path $baseDir 'PIC'
$dataDir       = Join-Path $baseDir 'Data'

# المسارات المحتملة لقاعدة البيانات داخل %APPDATA%
$userDataDirs = @(
    (Join-Path $env:APPDATA 'accounting-system-desktop'),
    (Join-Path $env:APPDATA 'Accounting System'),
    (Join-Path $env:APPDATA 'accounting-system')
)

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '   أداة الاستعادة - نظام المحاسبة' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# البحث عن ملفات النسخ الاحتياطي
$latestBackup = Join-Path $backupRootDir 'accounting-latest-backup.db'
$allBackups   = @()

if (Test-Path $backupRootDir) {
    $allBackups = Get-ChildItem -Path $backupRootDir -Filter 'accounting-backup-*.db' -File |
        Sort-Object Name -Descending
}

# أيضاً نتحقق من النسخة القديمة (من داخل البرنامج)
$oldStyleBackup = Join-Path $backupRootDir 'accounting-manual-backup.db'

# النسخة التلقائية من مجلد Data
$autoBackup = Join-Path $dataDir 'accounting-auto-backup.db'

# البحث عن نسخة تلقائية في %APPDATA%
$appDataAutoBackup = $null
foreach ($dir in $userDataDirs) {
    $candidate = Join-Path $dir 'accounting-auto-backup.db'
    if (Test-Path $candidate) {
        $appDataAutoBackup = $candidate
        break
    }
}

if (-not (Test-Path $latestBackup) -and $allBackups.Count -eq 0 -and -not (Test-Path $oldStyleBackup) -and -not (Test-Path $autoBackup) -and -not $appDataAutoBackup) {
    Write-Host '[خطأ] لا توجد نسخ احتياطية!' -ForegroundColor Red
    Write-Host ''
    Write-Host "تم البحث في: $backupRootDir" -ForegroundColor Yellow
    Write-Host 'يجب إنشاء نسخة احتياطية أولاً باستخدام أداة النسخ (backup.cmd).' -ForegroundColor Yellow
    Write-Host ''
    Read-Host 'اضغط Enter للخروج'
    exit 1
}

# عرض النسخ المتاحة
Write-Host 'النسخ الاحتياطية المتاحة:' -ForegroundColor Cyan
Write-Host ''

$options = @()
$index = 1

if (Test-Path $latestBackup) {
    $size = [math]::Round((Get-Item $latestBackup).Length / 1MB, 2)
    $date = (Get-Item $latestBackup).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    Write-Host "  [$index] آخر نسخة احتياطية (latest) - $date - $size MB" -ForegroundColor White
    $options += $latestBackup
    $index++
}

if (Test-Path $autoBackup) {
    $size = [math]::Round((Get-Item $autoBackup).Length / 1MB, 2)
    $date = (Get-Item $autoBackup).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    Write-Host "  [$index] نسخة تلقائية (Data) - $date - $size MB" -ForegroundColor White
    $options += $autoBackup
    $index++
}

# البحث عن نسخة تلقائية بجانب قاعدة البيانات في %APPDATA%
foreach ($dir in $userDataDirs) {
    $appDataAutoBackup = Join-Path $dir 'accounting-auto-backup.db'
    if (Test-Path $appDataAutoBackup) {
        $size = [math]::Round((Get-Item $appDataAutoBackup).Length / 1MB, 2)
        $date = (Get-Item $appDataAutoBackup).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
        Write-Host "  [$index] نسخة تلقائية (AppData) - $date - $size MB" -ForegroundColor White
        $options += $appDataAutoBackup
        $index++
        break
    }
}

if (Test-Path $oldStyleBackup) {
    $size = [math]::Round((Get-Item $oldStyleBackup).Length / 1MB, 2)
    $date = (Get-Item $oldStyleBackup).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    Write-Host "  [$index] نسخة من داخل البرنامج - $date - $size MB" -ForegroundColor White
    $options += $oldStyleBackup
    $index++
}

foreach ($backup in $allBackups) {
    $size = [math]::Round($backup.Length / 1MB, 2)
    Write-Host "  [$index] $($backup.Name) - $size MB" -ForegroundColor White
    $options += $backup.FullName
    $index++
}

Write-Host ''

# اختيار النسخة
$selectedBackup = $null
if ($options.Count -eq 1) {
    Write-Host 'يوجد نسخة واحدة فقط، سيتم استخدامها.' -ForegroundColor Gray
    $selectedBackup = $options[0]
} else {
    $choice = Read-Host "اختر رقم النسخة (1-$($options.Count))"
    $choiceNum = 0
    if ([int]::TryParse($choice, [ref]$choiceNum) -and $choiceNum -ge 1 -and $choiceNum -le $options.Count) {
        $selectedBackup = $options[$choiceNum - 1]
    } else {
        Write-Host '[خطأ] اختيار غير صحيح!' -ForegroundColor Red
        Read-Host 'اضغط Enter للخروج'
        exit 1
    }
}

$backupSize = [math]::Round((Get-Item $selectedBackup).Length / 1MB, 2)
Write-Host ''
Write-Host "النسخة المختارة: $selectedBackup ($backupSize MB)" -ForegroundColor Gray
Write-Host ''

# تأكيد الاستعادة
Write-Host '⚠  تحذير: الاستعادة ستستبدل كل البيانات الحالية في البرنامج!' -ForegroundColor Yellow
Write-Host '   تأكد أن البرنامج مغلق تماماً قبل المتابعة.' -ForegroundColor Yellow
Write-Host ''
$confirm = Read-Host 'هل تريد المتابعة؟ اكتب (نعم) للتأكيد'

if ($confirm -ne 'نعم' -and $confirm -ne 'y' -and $confirm -ne 'yes') {
    Write-Host 'تم الإلغاء.' -ForegroundColor Yellow
    Read-Host 'اضغط Enter للخروج'
    exit 0
}

Write-Host ''
Write-Host '[1/2] جاري استعادة النسخة الاحتياطية...' -ForegroundColor Cyan

$restoredCount = 0
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

foreach ($dir in $userDataDirs) {
    $destDb = Join-Path $dir 'accounting.db'

    # نتعامل فقط مع المجلدات الموجودة أو ننشئها كلها
    New-Item -ItemType Directory -Path $dir -Force | Out-Null

    # لو فيه داتابيز حالية، نعمل نسخة أمان منها
    if (Test-Path $destDb) {
        $safetyBackup = Join-Path $dir "accounting.pre-restore-$timestamp.db"
        try {
            Copy-Item -Path $destDb -Destination $safetyBackup -Force
            Write-Host "      نسخة أمان: $safetyBackup" -ForegroundColor Gray
        } catch {
            Write-Host "      [تحذير] تعذر إنشاء نسخة أمان في: $dir" -ForegroundColor Yellow
        }
    }

    try {
        Copy-Item -Path $selectedBackup -Destination $destDb -Force
        Write-Host "      تم الاستعادة في: $destDb" -ForegroundColor Green
        $restoredCount++
    } catch {
        Write-Host "      [خطأ] فشلت الاستعادة في: $dir - $_" -ForegroundColor Red
    }
}

if ($restoredCount -eq 0) {
    Write-Host ''
    Write-Host '[خطأ] فشلت الاستعادة في كل المسارات!' -ForegroundColor Red
    Read-Host 'اضغط Enter للخروج'
    exit 1
}

Write-Host ''
Write-Host "[2/2] تم بنجاح! ($restoredCount مسارات)" -ForegroundColor Green
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '   تمت الاستعادة بنجاح!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'يمكنك الآن تشغيل البرنامج وستجد كل بياناتك كما كانت.' -ForegroundColor Yellow
Write-Host ''
Read-Host 'اضغط Enter للخروج'
