# Scopre istanza/porta TCP MSSQL locale e crea login SQL readonly (catis_readonly).
# Eseguire in PowerShell **come amministratore** sulla macchina Windows.
#
# Uso:
#   .\setup-mssql-readonly.ps1 -HostIp 10.0.0.238 -DiscoverOnly
#   .\setup-mssql-readonly.ps1 -HostIp 10.0.0.238 -Database "MyDb" -Password "..."
#   .\setup-mssql-readonly.ps1 -HostIp 10.0.0.241 -Instance "MULTIDB_2022" -Database "lms_010" -Password "..."
param(
    [Parameter(Mandatory = $true)]
    [string]$HostIp,
    [string]$Instance = "",
    [string[]]$Database = @(),
    [string]$LoginName = "catis_readonly",
    [string]$Password = "",
    [switch]$DiscoverOnly
)

$ErrorActionPreference = "Stop"

function Write-Setup([string]$Message) {
    Write-Host "[setup-mssql] $Message"
}

function Write-SetupWarn([string]$Message) {
    Write-Host "[setup-mssql] ATTENZIONE: $Message" -ForegroundColor Yellow
}

function Write-SetupErr([string]$Message) {
    Write-Host "[setup-mssql] ERRORE: $Message" -ForegroundColor Red
}

function Find-SqlCmd {
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        return (Get-Command sqlcmd).Source
    }
    $candidates = @(
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\130\Tools\Binn\SQLCMD.EXE"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    throw "sqlcmd non trovato. Installa SSMS o SQL Server Command Line Tools."
}

function Get-SqlInstances {
    $keyPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
    if (-not (Test-Path $keyPath)) {
        throw "Nessuna istanza SQL Server nel registro ($keyPath)"
    }

    $props = Get-ItemProperty $keyPath
    $list = @()
    foreach ($prop in $props.PSObject.Properties) {
        if ($prop.Name -in @("PSPath", "PSParentPath", "PSChildName", "PSDrive", "PSProvider")) {
            continue
        }
        $instanceName = $prop.Name
        $instanceId = [string]$prop.Value
        $tcpPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
        $tcpPort = ""
        $tcpDynamic = ""
        if (Test-Path $tcpPath) {
            $tcp = Get-ItemProperty $tcpPath
            $tcpPort = [string]$tcp.TcpPort
            $tcpDynamic = [string]$tcp.TcpDynamicPorts
        }
        $list += [PSCustomObject]@{
            InstanceName = $instanceName
            InstanceId   = $instanceId
            TcpPort      = $tcpPort
            TcpDynamic   = $tcpDynamic
        }
    }
    return $list
}

function Get-RemoteConnectionName {
    param(
        [string]$HostIp,
        [string]$InstanceName,
        [string]$TcpPort,
        [string]$TcpDynamic
    )
    if ($TcpPort) {
        return "$HostIp,$TcpPort"
    }
    if ($TcpDynamic) {
        return "$HostIp,$TcpDynamic"
    }
    if ($InstanceName -eq "MSSQLSERVER") {
        return $HostIp
    }
    return "$HostIp\$InstanceName"
}

function Get-ServerConnectionName {
    param(
        [string]$InstanceName,
        [string]$TcpPort,
        [string]$TcpDynamic
    )
    if ($TcpPort) {
        return "localhost,$TcpPort"
    }
    if ($TcpDynamic) {
        return "localhost,$TcpDynamic"
    }
    if ($InstanceName -eq "MSSQLSERVER") {
        return "localhost"
    }
    return "localhost\$InstanceName"
}

function Invoke-AdminSql {
    param(
        [string]$Server,
        [string]$Query,
        [string]$Database = "master"
    )

    $sqlcmd = Find-SqlCmd
    $args = @("-S", $Server, "-d", $Database, "-C", "-b", "-Q", $Query, "-E")

    & $sqlcmd @args
    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd fallito (exit $LASTEXITCODE) su $Server"
    }
}

function Get-UserDatabases {
    param([string]$Server)

    $sqlcmd = Find-SqlCmd
    $query = "SET NOCOUNT ON; SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name;"
    $output = & $sqlcmd -S $Server -d master -E -C -h -1 -W -Q $query
    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile elencare database su $Server"
    }
    return @($output | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
}

function Test-SqlLogin {
    param(
        [string]$Server,
        [string]$Database,
        [string]$User,
        [string]$PlainPassword
    )

    $sqlcmd = Find-SqlCmd
    $query = "SET NOCOUNT ON; SELECT DB_NAME() AS db, USER_NAME() AS usr;"
    & $sqlcmd -S $Server -d $Database -U $User -P $PlainPassword -C -Q $query
    if ($LASTEXITCODE -ne 0) {
        throw "Login $User non funziona su $Server/$Database"
    }
}

function Enable-SqlLogin {
    param(
        [string]$Server,
        [string]$LoginName,
        [string]$PlainPassword,
        [string[]]$Databases
    )

    $escapedLogin = $LoginName.Replace("]", "]]")
    $escapedPass = $PlainPassword.Replace("'", "''")

    $loginSql = @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$escapedLogin')
  CREATE LOGIN [$escapedLogin] WITH PASSWORD = N'$escapedPass', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ELSE
  ALTER LOGIN [$escapedLogin] WITH PASSWORD = N'$escapedPass', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ALTER LOGIN [$escapedLogin] ENABLE;
"@

    Write-Setup "Creo/aggiorno login [$LoginName] su $Server ..."
    Invoke-AdminSql -Server $Server -Query $loginSql

    foreach ($db in $Databases) {
        $escapedDb = $db.Replace("]", "]]")
        $dbSql = @"
USE [$escapedDb];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$escapedLogin')
  CREATE USER [$escapedLogin] FOR LOGIN [$escapedLogin];
ALTER ROLE db_datareader ADD MEMBER [$escapedLogin];
"@
        Write-Setup "Grant db_datareader su [$db] ..."
        Invoke-AdminSql -Server $Server -Query $dbSql
    }
}

try {
    Write-Setup "IP macchina (rete verso Rocky): $HostIp"

    $instances = Get-SqlInstances
    if (-not $instances -or $instances.Count -eq 0) {
        throw "Nessuna istanza SQL trovata"
    }

    Write-Setup "Istanze SQL locali:"
    foreach ($inst in $instances) {
        $connLocal = Get-ServerConnectionName -InstanceName $inst.InstanceName -TcpPort $inst.TcpPort -TcpDynamic $inst.TcpDynamic
        $connRemote = Get-RemoteConnectionName -HostIp $HostIp -InstanceName $inst.InstanceName -TcpPort $inst.TcpPort -TcpDynamic $inst.TcpDynamic
        $portInfo = if ($inst.TcpPort) { "TCP fisso $($inst.TcpPort)" }
                    elseif ($inst.TcpDynamic) { "TCP dinamico $($inst.TcpDynamic)" }
                    else { "porta TCP non nel registro (prova 1433 o istanza nominata)" }
        Write-Setup "  - $($inst.InstanceName) => locale: $connLocal | remoto: $connRemote ($portInfo)"
    }

    if ($Instance) {
        $selected = $instances | Where-Object { $_.InstanceName -eq $Instance }
        if (-not $selected) {
            throw "Istanza '$Instance' non trovata. Usa -DiscoverOnly per l'elenco."
        }
    }
    elseif ($instances.Count -eq 1) {
        $selected = $instances[0]
        Write-Setup "Istanza selezionata (unica): $($selected.InstanceName)"
    }
    else {
        throw "Più istanze trovate. Specifica -Instance (es. -Instance 'MULTIDB_2022' o 'SQLEXPRESS')."
    }

    $server = Get-ServerConnectionName -InstanceName $selected.InstanceName -TcpPort $selected.TcpPort -TcpDynamic $selected.TcpDynamic
    $remoteServer = Get-RemoteConnectionName -HostIp $HostIp -InstanceName $selected.InstanceName -TcpPort $selected.TcpPort -TcpDynamic $selected.TcpDynamic

    Write-Setup "Connessione admin (locale): $server"
    Write-Setup "Connessione remota (Rocky):   $remoteServer"
    $mixed = Invoke-AdminSql -Server $server -Query "SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS WindowsOnly;" 2>$null
    Write-Setup "IsIntegratedSecurityOnly (1=solo Windows, 0=Mixed Mode):"
    Write-Host $mixed

    $dbs = Get-UserDatabases -Server $server
    Write-Setup "Database utente:"
    foreach ($db in $dbs) { Write-Setup "  - $db" }

    if ($DiscoverOnly) {
        Write-Setup "DiscoverOnly: nessuna modifica eseguita."
        if ($selected.TcpPort -or $selected.TcpDynamic) {
            $port = if ($selected.TcpPort) { $selected.TcpPort } else { $selected.TcpDynamic }
            Write-Setup "Su Rocky:"
            Write-Setup "  MSSQL_HOST=$HostIp MSSQL_PORT=$port MSSQL_DATABASE=<db>"
            Write-Setup "  MSSQL_USER=$LoginName MSSQL_PASSWORD='...' ./probe-mssql.sh --tables"
        }
        else {
            Write-Setup "Su Rocky:"
            Write-Setup "  .\probe-mssql.ps1 -SqlHost $HostIp -Instance '$($selected.InstanceName)' -User $LoginName -Password '...' -Database <db>"
        }
        exit 0
    }

    if (-not $Password) {
        throw "Specifica -Password per creare il login $LoginName"
    }

    $targetDbs = @($Database | Where-Object { $_ })
    if ($targetDbs.Count -eq 0) {
        if ($dbs.Count -eq 1) {
            $targetDbs = @($dbs[0])
            Write-SetupWarn "Database non specificato: uso l'unico disponibile '$($targetDbs[0])'"
        }
        else {
            throw "Specifica -Database (es. -Database 'lms_010'). Database disponibili: $($dbs -join ', ')"
        }
    }

    foreach ($db in $targetDbs) {
        if ($db -notin $dbs) {
            throw "Database '$db' non trovato. Disponibili: $($dbs -join ', ')"
        }
    }

    Enable-SqlLogin -Server $server -LoginName $LoginName -PlainPassword $Password -Databases $targetDbs

    foreach ($db in $targetDbs) {
        Write-Setup "Verifica login su $db ..."
        Test-SqlLogin -Server $server -Database $db -User $LoginName -PlainPassword $Password
    }

    Write-Setup "Completato."
    Write-Setup "Da Rocky/Linux:"
    if ($selected.TcpPort -or $selected.TcpDynamic) {
        $port = if ($selected.TcpPort) { $selected.TcpPort } else { $selected.TcpDynamic }
        Write-Setup "  MSSQL_HOST=$HostIp MSSQL_PORT=$port MSSQL_DATABASE=$($targetDbs[0])"
        Write-Setup "  MSSQL_USER=$LoginName MSSQL_PASSWORD='...' ./probe-mssql.sh --tables"
    }
    else {
        Write-Setup "  .\probe-mssql.ps1 -SqlHost $HostIp -Instance '$($selected.InstanceName)' -User $LoginName -Password '...' -Database $($targetDbs[0])"
    }
    exit 0
}
catch {
    Write-SetupErr $_.Exception.Message
    exit 1
}
