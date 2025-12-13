# Auto-Update Proces voor HAL5 Facturatie Manager

## Overzicht

De applicatie controleert automatisch op updates via GitHub Releases. Alle data blijft veilig in Supabase tijdens updates.

## Eenmalige Setup

### 1. GitHub Repository Configureren

Pas `electron-builder.json` aan met jouw GitHub gegevens:

```json
"publish": {
  "provider": "github",
  "owner": "JOUW-GITHUB-USERNAME",
  "repo": "JOUW-REPO-NAAM"
}
```

### 2. GitHub Token Aanmaken

1. Ga naar GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Klik "Generate new token (classic)"
3. Geef het token een naam (bijv. "HAL5 Release Token")
4. Selecteer scope: `repo` (volledige controle)
5. Klik "Generate token" en kopieer het token
6. Sla het token veilig op

### 3. Token Configureren

**Windows:**
```bash
setx GH_TOKEN "jouw-github-token"
```

Herstart daarna je terminal/command prompt.

**Of tijdelijk per sessie:**
```bash
set GH_TOKEN=jouw-github-token
npm run electron:publish
```

## Update Publiceren

### Stap 1: Versienummer Verhogen

Pas in `package.json` het versienummer aan:

```json
{
  "version": "1.1.0"  // Was 1.0.0
}
```

**Versie nummering:**
- `1.0.0` → `1.0.1` voor bugfixes
- `1.0.0` → `1.1.0` voor nieuwe features
- `1.0.0` → `2.0.0` voor grote wijzigingen

### Stap 2: Bouwen en Publiceren

```bash
npm run electron:publish
```

Dit doet automatisch:
1. Bouwt de React applicatie
2. Maakt de Windows installer
3. Upload naar GitHub Releases
4. Genereert update metadata

### Stap 3: Release Notes (Optioneel)

Ga naar GitHub → Releases en voeg release notes toe:
- Beschrijf wat er nieuw is
- Noem bugfixes
- Vermeld bekende issues

## Voor Eindgebruikers

### Eerste Installatie

1. Download de installer van GitHub Releases
2. Run `HAL5 Facturatie Manager-Setup-X.X.X.exe`
3. Volg de installatie wizard
4. Start de applicatie

### Updates Ontvangen

**Automatisch proces:**

1. App controleert bij opstarten op updates (na 3 seconden)
2. Als update beschikbaar: melding verschijnt
3. Gebruiker klikt "Download Update"
4. Update downloadt op achtergrond
5. Bij afsluiten wordt update geïnstalleerd
6. Bij volgende start: nieuwe versie actief

**Belangrijk:**
- Geen data verlies mogelijk (alles staat in Supabase)
- Gebruiker kan update uitstellen
- Update wordt geïnstalleerd bij afsluiten
- Handmatig herstarten is optioneel

## Technische Details

### Update Controle

- Controleert automatisch na 3 seconden bij opstarten
- Alleen in productie mode (niet tijdens development)
- Gebruikt GitHub Releases API

### Update Files

In GitHub Releases worden aangemaakt:
- `HAL5 Facturatie Manager-Setup-X.X.X.exe` - Volledige installer
- `latest.yml` - Update metadata
- Checksums voor beveiliging

### Rollback

Als een update problemen geeft:
1. Download vorige versie van GitHub Releases
2. Installeer over huidige versie
3. Of gebruik Windows "Programma's wijzigen" om vorige versie te herstellen

## Troubleshooting

### Update wordt niet gevonden

- Check internet verbinding
- Controleer GitHub repository settings (public of private)
- Verify token permissions

### Publish faalt

**"No GitHub token found"**
```bash
setx GH_TOKEN "jouw-token"
```
Herstart terminal en probeer opnieuw.

**"Repository not found"**
- Check owner en repo naam in `electron-builder.json`
- Verify token heeft toegang tot de repository

### App toont geen update melding

- Check of versienummer in `package.json` correct is verhoogd
- Verify dat GitHub Release is gepubliceerd (niet draft)
- Check console logs voor errors

## Best Practices

1. **Test lokaal eerst:** Gebruik `npm run electron:build:dir` voor lokale test
2. **Versie nummering:** Volg semantische versioning (major.minor.patch)
3. **Backup maken:** Voor grote updates, maak eerst een backup van critical data
4. **Release notes:** Schrijf altijd duidelijke release notes voor gebruikers
5. **Test update:** Test het update proces op een testmachine eerst

## Data Veiligheid

Alle applicatie data staat in Supabase:
- Database migraties worden automatisch toegepast
- Geen lokale data die verloren kan gaan
- Updates beïnvloeden alleen de applicatie code
- Gebruikers behouden al hun gegevens

## Support

Bij vragen of problemen met updates:
1. Check eerst de console logs (F12 in de app)
2. Verify GitHub Release is correct gepubliceerd
3. Check internet connectie en firewall settings
