# Netlify Deployment Instructies

Deze applicatie is geconfigureerd voor automatische deployment naar Netlify (100% gratis).

## Stap 1: Netlify Account aanmaken

1. Ga naar [netlify.com](https://netlify.com)
2. Klik op **Sign up** (rechts boven)
3. Kies **Sign up with GitHub** (makkelijkst)
4. Geef Netlify toestemming om je repositories te zien

## Stap 2: Project deployen

### Via Netlify Dashboard (makkelijkst):

1. Klik op **Add new site** → **Import an existing project**
2. Kies **Deploy with GitHub**
3. Selecteer je repository uit de lijst
   - Zie je je repo niet? Klik op "Configure Netlify on GitHub" en geef toegang
4. Build settings (laat deze staan, is al geconfigureerd):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Klik op **Deploy site**

Klaar! Na 1-2 minuten is je site live.

## Stap 3: Je URLs vinden

Na deployment zie je:

- **Admin app**: `https://jouw-site-naam.netlify.app/`
- **Boekingspagina**: `https://jouw-site-naam.netlify.app/booking.html`

### Custom sitenaam instellen (optioneel):

1. Ga naar **Site settings** → **Site details**
2. Bij **Site name** klik op **Change site name**
3. Kies een naam zoals: `hal5-facturatie`
4. Je nieuwe URL wordt: `https://hal5-facturatie.netlify.app/`

## Stap 4: Automatische updates

Elke keer dat je naar GitHub pusht, deployt Netlify automatisch:

```bash
git add .
git commit -m "Update booking page"
git push origin main
```

Netlify bouwt en publiceert automatisch de nieuwe versie!

## Deploy status checken

1. Log in op Netlify
2. Klik op je site
3. Bekijk **Deploys** tab voor:
   - Status van deployment
   - Build logs
   - Preview van wijzigingen

## Custom Domain koppelen (optioneel)

Als je een eigen domeinnaam hebt (zoals `hal5overloon.nl`):

1. Ga naar **Site settings** → **Domain management**
2. Klik op **Add custom domain**
3. Voer je domeinnaam in
4. Volg de instructies om DNS in te stellen bij je domain provider

Netlify geeft automatisch:
- Gratis SSL certificaat (HTTPS)
- Wereldwijd CDN voor snelheid

## Kosten

**Volledig gratis** voor:
- 100 GB bandbreedte per maand
- 300 build minuten per maand
- Private én publieke repositories
- SSL certificaten
- Automatische deployments

Dit is **meer dan genoeg** voor een boekingspagina en admin tool.

## Troubleshooting

### Site bouwt niet

1. Check **Deploys** tab voor error logs
2. Test lokaal: `npm run build`
3. Los eventuele TypeScript/build errors op
4. Push opnieuw naar GitHub

### Wijzigingen niet zichtbaar

1. Check of deployment is voltooid (groene vinkje in Deploys)
2. Hard refresh browser (Ctrl+F5 of Cmd+Shift+R)
3. Wacht 1-2 minuten na push

### Repository niet zichtbaar in Netlify

1. Ga naar [app.netlify.com/account/sites](https://app.netlify.com/account/sites)
2. Scroll naar beneden → **Configure Netlify on GitHub**
3. Geef toegang tot je specifieke repository

## Extra features (optioneel)

### Deploy previews
- Elke pull request krijgt automatisch een preview URL
- Test wijzigingen voordat je merged

### Environment variables
Als je API keys wilt toevoegen:
1. **Site settings** → **Environment variables**
2. Voeg variabelen toe (bijv. voor emails)

### Formulier notificaties
Netlify kan automatisch emails sturen bij nieuwe boekingen:
1. **Site settings** → **Forms**
2. Stel notificaties in

## Handige links

- **Netlify Dashboard**: [app.netlify.com](https://app.netlify.com)
- **Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Support**: [answers.netlify.com](https://answers.netlify.com)

## Volgende stappen

Na deployment kun je:

1. Je boekingspagina URL delen met klanten
2. Custom domain koppelen voor professionele uitstraling
3. Analytics bekijken in Netlify dashboard
4. Wijzigingen pushen - automatisch live binnen 2 minuten
