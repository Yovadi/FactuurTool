# Auto-Update Troubleshooting

## Veranderingen Doorgevoerd

Ik heb de volgende verbeteringen aangebracht aan de auto-update functionaliteit:

1. **Uitgebreide logging** - De app logt nu meer informatie over update checks
2. **Periodieke update checks** - De app checkt nu elk uur automatisch voor updates (in plaats van alleen bij opstarten)
3. **Betere error handling** - Fouten worden nu duidelijker gelogd
4. **electron-log toegevoegd** - Voor betere logging naar bestand
5. **Release configuratie aangepast** - `private: false` zodat updates toegankelijk zijn

## Waarom Werken Auto-Updates Mogelijk Niet?

### 1. App is Niet Geïnstalleerd
**BELANGRIJKSTE REDEN**: Auto-updates werken ALLEEN als de app is geïnstalleerd via de Setup.exe installer!

- ✅ **WEL werken**: App geïnstalleerd via `HAL5 Facturatie Manager-Setup-1.0.1.exe`
- ❌ **NIET werken**: App direct uitgevoerd vanuit een uitgepakte map of ZIP bestand

**Oplossing**: Zorg dat op de andere PC de app is geïnstalleerd via de Setup.exe

### 2. Private Repository Toegang
Je GitHub repository is private, maar electron-updater moet de releases kunnen benaderen.

**Oplossing**:
- Optie A: Maak de GitHub releases public (repository kan private blijven)
- Optie B: Gebruik een custom update server

### 3. latest.yml Bestand
De `latest.yml` moet aanwezig zijn in de GitHub release voor auto-updates.

**Check**: Ga naar https://github.com/Yovadi/FactuurTool/releases/latest en kijk of er een `latest.yml` bestand is geüpload.

### 4. Versie Controle
De app checkt alleen voor updates als er een NIEUWERE versie beschikbaar is.

**Huidige versie**: `1.0.1` (in package.json)

**Oplossing**:
- Check welke versie op de andere PC draait
- Update alleen als de nieuwe versie hoger is dan de huidige

### 5. Firewall/Antivirus
Soms blokkeren firewall of antivirus de update check naar GitHub.

**Check**:
- Tijdelijk firewall/antivirus uitschakelen om te testen
- Check of github.com bereikbaar is

## Hoe Te Debuggen

### Stap 1: Check Console Logs
Start de app op de andere PC en open de Developer Console:

1. Start de app
2. Druk op `Ctrl + Shift + I` om Developer Tools te openen
3. Ga naar het `Console` tabblad
4. Zoek naar deze berichten:
   ```
   App version: 1.0.1
   App path: ...
   Checking for updates...
   ```

### Stap 2: Check Log Bestanden
electron-log schrijft nu naar een bestand. De locatie:

**Windows**: `%USERPROFILE%\AppData\Roaming\HAL5 Facturatie Manager\logs\main.log`

Open dit bestand en zoek naar update gerelateerde berichten.

### Stap 3: Verifieer Installatie
Controleer of de app correct is geïnstalleerd:

1. Open `Apps & features` in Windows
2. Zoek naar "HAL5 Facturatie Manager"
3. Als deze niet in de lijst staat, is de app NIET geïnstalleerd en werken updates NIET

### Stap 4: Handmatig Update Check
Je kunt in de console handmatig een update check triggeren:

```javascript
require('electron').remote.autoUpdater.checkForUpdates()
```

## Nieuwe Release Publiceren

Om een nieuwe versie uit te brengen die automatisch wordt gedetecteerd:

1. **Update package.json versie**:
   ```json
   "version": "1.0.2"
   ```

2. **Build en publiceer**:
   ```bash
   npm run electron:publish
   ```

3. **Verifieer GitHub Release**:
   - Ga naar https://github.com/Yovadi/FactuurTool/releases
   - Check of de nieuwe release zichtbaar is
   - Verifieer dat `latest.yml` is geüpload

4. **Test op andere PC**:
   - Start de app
   - Wacht 3-5 seconden
   - Je zou een melding moeten zien: "Nieuwe versie X.X.X is beschikbaar!"

## Meest Waarschijnlijke Oplossing

**De app is waarschijnlijk niet geïnstalleerd op de andere PC!**

✅ **Doe dit:**
1. Download `HAL5 Facturatie Manager-Setup-1.0.1.exe` van GitHub releases
2. Voer de installer uit op de andere PC
3. Volg de installatie wizard
4. Start de app vanuit het Start Menu of Desktop shortcut
5. De auto-update zou nu moeten werken

❌ **Niet dit:**
- De .exe direct kopiëren en uitvoeren
- De app uitpakken en vanuit een map uitvoeren
- Portable versies gebruiken

## Nog Steeds Problemen?

Als het nog steeds niet werkt, stuur me dan:

1. De inhoud van het log bestand (`main.log`)
2. Screenshot van de Console logs
3. Bevestiging dat de app via Setup.exe is geïnstalleerd
4. De huidige versie die op de PC draait

## Quick Test

Om snel te testen of updates werken:

1. Installeer versie 1.0.1 op de test PC
2. Publiceer een nieuwe versie 1.0.2 naar GitHub
3. Start de app op de test PC
4. Binnen 5 seconden zou je een update melding moeten zien
