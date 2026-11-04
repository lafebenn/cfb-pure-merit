# Lovable prompt — CFB Pure Merit Rankings UI

Copy everything below the line into Lovable (or open the prefilled link).

---

Build a premium, production-ready single-page **College Football rankings web app** called **CFB Pure Merit Rankings**. This is a fan analytics product — NOT affiliated with the College Football Playoff. Do not use CFP logos, wordmarks, or trademarked branding. Imitate the *feel* of a major CFB rankings release site only through color, typography, and polish.

## Visual direction
- Near-black background (#070708) with subtle warm gold radial glow at the top
- Accent gold #C9A227 / bright gold #E8C547 for ranks, scores, and hairline rules
- Off-white primary text (#F4F1EA), muted secondary (#9A958A)
- Font: distinctive modern sans (Outfit, Sora, or similar) — not Inter/Roboto/system default
- Generous whitespace, tight hierarchy, no generic AI “dashboard card farm”
- First viewport = one composition: brand title dominant, one subtitle, last-updated line, one CTA to formula
- Soft motion: fade/rise on hero, subtle row hover, podium card entrance (2–3 motions max)
- Fully responsive; table must work on mobile (horizontal scroll OK with sticky team column if needed)

## Page structure
1. **Header / hero**
   - Eyebrow: “2026 Season · Advanced Pure Merit”
   - H1: “CFB Pure Merit Rankings” (largest type on the page)
   - One short supporting sentence about transparent formula + live data
   - “Last updated” timestamp
   - Link: “How the formula works”

2. **Top of the board** — 4 featured team panels for ranks 1–4
   - Logo, rank, school, conference, record, big Merit score
   - Rank 1 gets a subtle gold treatment (not a sticker/badge pile)

3. **Full Top 25 table**
   Columns: Rank | Team (logo + name + conference) | Record | Merit (3 decimals) | Base | Road Pts | >.500 Wins | SOS | PD Cap
   - Hover/focus a row → elegant expanded panel (not every row open at once) showing:
     - FBS wins, voided FCS wins, road wins, quality wins
     - Loss penalty tiers (road>.660 / standard≥.500 / weak<.500 / FCS)
     - OW%, OOW%, SOS, avg margin → PD cap
   - Clean borders, monospace for numbers, gold header labels

4. **Methodology section**
   Total = Base + Difficulty + Schedule Strength + Game Control
   - Base: +1 FBS win; FCS wins 0; loss tiers −0.5 / −1 / −2 / −3 FCS
   - Difficulty: +0.5 true road win; +1 quality win (opp win% > .500)
   - SOS: OW% + 0.5×OOW%
   - Game control: avg PD/100 capped at +0.17
   Footer disclaimer: unofficial; not affiliated with CFP/NCAA

## Data / implementation for Lovable MVP
Use hard-coded sample Top 25 rows that look real (Indiana, Miami, UCLA, Utah, etc.) with plausible decimals so the design can be judged. Structure components so swapping in a live API later is easy (typed TeamRanking objects).
No login, no database in v1.

## Design anti-patterns to avoid
- Purple gradients, glassmorphism overload, emoji, floating badge stickers on hero
- Dense “admin dashboard” chrome
- Tiny unreadable tables or pill soup
- Generic Inter-on-white startup look

Make it feel like a serious weekly rankings product someone would bookmark.
