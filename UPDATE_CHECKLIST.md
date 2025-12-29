# Update Niet Gedetecteerd - Checklist

## Situatie
- PC heeft versie: **1.0.4**
- Beschikbare versie op GitHub: **1.0.6**
- Update wordt NIET gedetecteerd

## Meest Waarschijnlijke Oorzaken

### 1. ❌ App Niet Correct Geïnstalleerd (80% kans)
**Probleem**: Auto-updates werken ALLEEN als de app is geïnstalleerd via de Setup installer.

**Check**:
1. Open Windows `Instellingen` → `Apps` → `Apps en onderdelen`
2. Zoek naar "HAL5 Facturatie Manager"
3. Staat deze in de lijst?
   - ✅ **JA**: App is correct geïnstalleerd
   - ❌ **NEE**: App is NIET geïnstalleerd, updates werken niet!

**Oplossing**:
1. Download `HAL5 Facturatie Manager-Setup-1.0.6.exe` van GitHub
2. Voer de installer uit
3. Herstart de app

### 2. 🔒 GitHub Release Niet Publiek (15% kans)
**Probleem**: Je repository is private. De releases moeten publiek toegankelijk zijn.

**Check**:
1. Ga naar: https://github.com/Yovadi/FactuurTool/releases/latest
2. Kun je de release zien zonder in te loggen?
   - ✅ **JA**: Release is publiek
   - ❌ **NEE**: Release is private

**Oplossing**:
1. Ga naar je GitHub repository
2. Settings → General → scroll naar "Danger Zone"
3. Of maak de releases publiek via Settings

### 3. 📄 latest.yml Ontbreekt (5% kans)
**Probleem**: Het `latest.yml` bestand is vereist voor auto-updates.

**Check**:
1. Ga naar: https://github.com/Yovadi/FactuurTool/releases/latest
2. Zie je een bestand genaamd `latest.yml` in de assets?
   - ✅ **JA**: latest.yml is aanwezig
   - ❌ **NEE**: latest.yml ontbreekt

**Oplossing**:
- Publiceer opnieuw met: `npm run electron:publish`

## Stap-voor-Stap Debug Proces

### Stap 1: Open Developer Console
1. Start de app op PC met versie 1.0.4
2. Druk op `F12` of `Ctrl + Shift + I`
3. Ga naar het `Console` tabblad
4. Klik op "Check voor Updates" knop
5. Bekijk de console output

**Zoek naar deze regels**:
```
=== MANUAL UPDATE CHECK ===
Current version: 1.0.4
Feed URL: ...
Is app packaged? true/false
App path: ...
```

**Belangrijk**:
- **Is app packaged? false** → App is NIET geïnstalleerd, updates werken NIET
- **Is app packaged? true** → App is correct geïnstalleerd

### Stap 2: Check Log Bestanden
Locatie: `%USERPROFILE%\AppData\Roaming\HAL5 Facturatie Manager\logs\main.log`

1. Open Windows Verkenner
2. Typ in adresbalk: `%APPDATA%\HAL5 Facturatie Manager\logs`
3. Open `main.log`
4. Zoek naar "UPDATE CHECK" berichten

### Stap 3: Test Handmatig
Open de console (F12) en voer uit:
```javascript
// Check huidige versie
console.log('Current version:', require('electron').remote.app.getVersion())

// Check of app geïnstalleerd is
console.log('Is packaged?', require('electron').remote.app.isPackaged)
```

## Snelle Oplossing (Meest Effectief)

Als je zeker wilt zijn dat updates werken:

1. **Deïnstalleer** de huidige app (via Windows Instellingen)
2. **Download** `HAL5 Facturatie Manager-Setup-1.0.6.exe` van GitHub releases
3. **Installeer** via de Setup wizard
4. **Start** de app vanuit Start Menu
5. **Wacht** 5 seconden → update check gebeurt automatisch

## Veelvoorkomende Fouten

❌ **FOUT**: App direct kopiëren naar andere PC
✅ **GOED**: Setup installer gebruiken

❌ **FOUT**: App uitvoeren vanuit Downloads map
✅ **GOED**: App installeren via Setup.exe

❌ **FOUT**: Portable/unpacked versie gebruiken
✅ **GOED**: NSIS installer versie gebruiken

## Als Het Nog Steeds Niet Werkt

Stuur me deze informatie:

1. **Console output** van de update check (screenshot of tekst)
2. **Inhoud van main.log** (laatste 50 regels)
3. **Bevestiging**:
   - [ ] App staat in Windows Apps lijst
   - [ ] App geïnstalleerd via Setup.exe
   - [ ] Huidige versie: ___
   - [ ] Is app packaged? (true/false): ___
4. **Screenshot** van GitHub releases pagina

## Extra: Force Update Check

Als je wilt forceren dat de app opnieuw checkt:

1. Sluit de app volledig
2. Verwijder cache: `%APPDATA%\HAL5 Facturatie Manager\Cache`
3. Start de app opnieuw
4. Wacht 5 seconden voor automatische check

## Test Scenario

Om te testen of auto-updates werken:

1. Installeer versie 1.0.4 op test PC
2. Publiceer versie 1.0.7 naar GitHub (hogere versie)
3. Start app op test PC
4. Binnen 5 seconden moet popup verschijnen: "Nieuwe versie 1.0.7 is beschikbaar!"

Als deze popup NIET verschijnt → app is niet correct geïnstalleerd!
