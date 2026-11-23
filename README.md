# Mapování – trénink (PWA)

Offline aplikace na procvičování všech 250 otázek z předmětu Mapování BEA011:
**Test 3** (T3-001 až T3-200) a **Test 5** (T5-001 až T5-050).

| Sada | Počet |
|---|---|
| T3-ucitel | 11 |
| T3-tip | 189 |
| T5-ucitel | 10 |
| T5-tip | 20 |
| T5-tip2 | 20 |

Otázky jsou v `data.js` převzaté z PDF beze změny znění.

## Režimy
- **Test s výběrem odpovědí**: výběr testu, sad a okruhů, ★ slabá místa, „jen co jsem pokazil“, počet otázek, rychlý režim, stopky
- **Učení s nápovědou**: píšeš nebo diktuješ, nápověda odkrývá začátek odpovědi, sebehodnocení Umím / Skoro / Neumím
- **Kartičky**: Leitnerův systém, krabičky 0–4
- **Rychlovka**: 60 s, combo, rekord
- **Simulace testu**: 10 otázek (aspoň 5 učitelových), body 0 / 0,5 / 1
- **Statistiky**, XP a úrovně, série dnů, denní cíl 30 otázek, export a import zálohy

## Nasazení (PWA potřebuje HTTPS)

### Varianta A – GitHub Pages
1. Na GitHubu otevři repozitář → **Settings** → **Pages**.
2. V části *Build and deployment* zvol **Deploy from a branch**, vyber větev s aplikací a složku `/ (root)`, ulož.
3. Za 1–2 minuty bude aplikace na adrese `https://<uživatel>.github.io/<repozitář>/`.

### Varianta B – Netlify Drop
1. Otevři https://app.netlify.com/drop.
2. Přetáhni do okna celou složku s aplikací (index.html, app.js, data.js, styles.css, sw.js, manifest.webmanifest a ikony).
3. Dostaneš HTTPS adresu, kterou otevřeš v telefonu.

## Instalace na Android (Chrome)
1. V telefonu otevři adresu aplikace v **Chrome**.
2. Klepni na **⋮** (vpravo nahoře) → **Instalovat aplikaci** (případně **Přidat na plochu**).
3. Potvrď **Instalovat**. Ikona „Mapování“ se objeví na ploše.
4. Aplikaci jednou otevři s internetem. Potom funguje i offline.

## Aktualizace
Po změně souborů zvyš `VERSION` v `sw.js`. Aplikace pak nahoře ukáže „Je nová verze – Načíst“.

## Data
Data se ukládají v prohlížeči (localStorage, klíč `mapovani_t3t5_v1`). Před odinstalováním nebo přechodem na jiný telefon použij **Záloha → Exportovat zálohu**.
