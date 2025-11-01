# Netlify Deployment - Alleen Boekingspagina

Deze configuratie zorgt ervoor dat **alleen de boekingspagina** online komt op Netlify.
De facturatie tool draait lokaal op je Windows PC als Electron app.

## Overzicht

- **Facturatie tool** → Lokaal op Windows (Electron app via `npm run electron:build`)
- **Boekingspagina** → Online op Netlify (voor klanten die willen boeken)
- **Database** → Gedeelde Supabase database voor beide

## Stap 1: Netlify Account aanmaken

1. Ga naar [netlify.com](https://netlify.com)
2. Klik op **Sign up** (rechts boven)
3. Kies **Sign up with GitHub** (makkelijkst)
4. Geef Netlify toestemming om je repositories te zien

## Stap 2: Boekingspagina deployen

### Via Netlify Dashboard:

1. Klik op **Add new site** → **Import an existing project**
2. Kies **Deploy with GitHub**
3. Selecteer je repository uit de lijst
   - Zie je je repo niet? Klik op "Configure Netlify on GitHub" en geef toegang
4. Build settings worden automatisch ingelezen uit `netlify.toml` (laat staan)
5. Klik op **Deploy site**

Klaar! Na 1 minuut is alleen de boekingspagina live.

## Stap 3: Je boekingspagina URL

Na deployment:

- **Boekingspagina**: `https://jouw-site-naam.netlify.app/`

Let op: Netlify host **alleen** de boekingspagina, niet de admin tool!

### Custom sitenaam instellen:

1. Ga naar **Site settings** → **Site details**
2. Bij **Site name** klik op **Change site name**
3. Kies een naam zoals: `hal5-boeken`
4. Je nieuwe URL wordt: `https://hal5-boeken.netlify.app/`

## Stap 4: Windows Facturatie App bouwen

Voor de lokale facturatie tool op je Windows PC:

```bash
# In je project folder
npm run electron:build
```

Dit maakt een Windows installer in de `dist` folder. Installeer deze op je Windows PC.

## Hoe het werkt

1. **Jij** gebruikt de lokale Electron app op je Windows PC voor:
   - Facturen beheren
   - Huurders beheren
   - Ruimtes beheren
   - Boekingen bekijken

2. **Klanten** gebruiken de online boekingspagina voor:
   - Vergaderruimte boeken
   - Datum en tijd kiezen
   - Automatisch in jouw systeem

3. **Database** (Supabase):
   - Beide systemen gebruiken dezelfde database
   - Boekingen van klanten verschijnen direct in jouw admin app
   - Real-time synchronisatie

## Updates maken

### Boekingspagina updaten:

Als je wijzigingen maakt aan `public/booking.html`:

```bash
git add public/booking.html
git commit -m "Update booking page"
git push origin main
```

Netlify deployt automatisch binnen 1 minuut!

### Facturatie app updaten:

Als je wijzigingen maakt aan de admin tool:

```bash
npm run electron:build
```

Installeer de nieuwe versie op je Windows PC.

## Deploy status checken

1. Log in op Netlify
2. Klik op je site
3. Bekijk **Deploys** tab voor:
   - Status van deployment
   - Build logs
   - Preview van wijzigingen

## Custom Domain koppelen (optioneel)

Als je een eigen domeinnaam hebt (zoals `boeken.hal5overloon.nl`):

1. Ga naar **Site settings** → **Domain management**
2. Klik op **Add custom domain**
3. Voer je subdomain in (bijv. `boeken.hal5overloon.nl`)
4. Volg de instructies om DNS in te stellen bij je domain provider

Netlify geeft automatisch:
- Gratis SSL certificaat (HTTPS)
- Wereldwijd CDN voor snelheid

## Kosten

**Volledig gratis** voor:
- 100 GB bandbreedte per maand (meer dan genoeg)
- 300 build minuten per maand
- Private én publieke repositories
- SSL certificaten
- Automatische deployments

## Belangrijke bestanden

- **`public/booking.html`** - De boekingspagina (online via Netlify)
- **`src/`** - De admin tool (lokaal als Electron app)
- **`netlify.toml`** - Netlify configuratie (deploy alleen booking.html)
- **`electron/`** - Electron configuratie voor Windows app

## Troubleshooting

### Site bouwt niet

1. Check **Deploys** tab voor error logs
2. Controleer of `public/booking.html` bestaat
3. Push opnieuw naar GitHub

### Wijzigingen niet zichtbaar

1. Check of deployment is voltooid (groene vinkje in Deploys)
2. Hard refresh browser (Ctrl+F5 of Cmd+Shift+R)
3. Wacht 1-2 minuten na push

### Repository niet zichtbaar in Netlify

1. Ga naar [app.netlify.com/account/sites](https://app.netlify.com/account/sites)
2. Scroll naar beneden → **Configure Netlify on GitHub**
3. Geef toegang tot je specifieke repository

### Boekingen verschijnen niet in admin app

- Beide systemen gebruiken dezelfde Supabase database
- Check of je Supabase credentials correct zijn in `.env`
- Herstart je Electron app

## Handige links

- **Netlify Dashboard**: [app.netlify.com](https://app.netlify.com)
- **Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Support**: [answers.netlify.com](https://answers.netlify.com)

## Volgende stappen

Na deployment:

1. Test de boekingspagina op Netlify URL
2. Deel de URL met klanten
3. Check nieuwe boekingen in je lokale admin app
4. Optioneel: Koppel custom domain voor professionele uitstraling
