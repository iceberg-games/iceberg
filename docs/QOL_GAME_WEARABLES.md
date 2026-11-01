# QoL GM2 game wearables — Cosmetics 2 lane (no event)

Branch `cosmetics/qol-game-wearables-lane2`. All items are **shop-buyable** (games not wired yet → no unlock quests).
Each catalog entry carries `game: '<gm2 id>'` so GM2 can later add `earnIn`/quest variants (`gd_quest_*`, `ss_quest_*`, `pp_quest_*`).
Builders: `src/game/cosmetics/qolGameWearables.js` (`QOL_GAME_BUILDERS`, `QOL_GAME_PREVIEW_FOCUS`).

| Game | id | slot | price | rarity | juice |
|---|---|---|---|---|---|
| Glacier Drift | gd_boost_helmet | hat | 300 | epic | boost pulse squash, bolt glow, streaming trail |
| Glacier Drift | gd_drift_visor | face | 180 | rare | iridescent lens, sweeping glint, orbit sparkles |
| Glacier Drift | gd_magnet_scarf | neck | 220 | rare | wiggling magnet, sparkles pulled inward, tail sway |
| Glacier Drift | gd_rocket_sled | back | 360 | legendary | twin jet flame stream, flicker cores, rumble |
| Snowball Siege | ss_fort_helm | hat | 260 | epic | rippling team flag, merlon bounce, powder puffs |
| Snowball Siege | ss_war_paint | face | 120 | common | pulsing glow stripes, bouncing flake |
| Snowball Siege | ss_ammo_bandolier | neck | 200 | rare | snowball squish wave, traveling twinkle |
| Snowball Siege | ss_flag_banner | back | 320 | epic | cloth wave, drifting flakes |
| Snowball Siege | ss_snowball_launcher | hand | 340 | legendary | recoil + lobbed snowball arc + muzzle poof |
| Pengu Plaza | pp_beanie_pompom | hat | 160 | common | bouncy pom, blinking pengu patch, hearts |
| Pengu Plaza | pp_cocoa_mug | hand | 140 | common | swirling marshmallows, steam, warm light |
| Pengu Plaza | pp_pengu_backpack | back | 280 | epic | waddle, blink, flipper wave, sparkle notes |
| Pengu Plaza | pp_photo_camera | neck | 220 | rare | sway, star-burst flash |

Preview: `npx vite` then `/scripts/cosmetic-preview.html?id=<id>&angle=front|side|threequarter|back`.

Hook: avatar.js needs `Object.assign(BUILDERS, QOL_GAME_BUILDERS)` (separate commit on this branch so it can be dropped/re-applied at merge).
