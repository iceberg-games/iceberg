# Rimebound — Design Brief (GM2: kits, lore, lobby, character select, emotes)

> CAST FINAL (Jojo/Colin): **Pip set confirmed.** Mira set (Mira/Jonah/Kade/Hollow/Rigmour/Pale) is SUPERSEDED.
> Cosmetics: remap in-progress meshes by slot — mira→pip, jonah→nell, kade→juno, hollow→hullwarden, rigmour→kettle, pale→whitepeak.

GAME_ID: `rimebound` · Sets: `rimebound-lobby`, `rimebound-shipyard`, `rimebound-mines`, `rimebound-resort`

## Ownership (LOCKED)
- GM1: core loop + maps (thaw cores, chase, frostbitten down/revive, exits)
- GM2: kits + lore + lobby + character select + emotes
- Cosmetics: character Blender meshes · Set Builders: map sets · Sound 1: `/workspace/iceberg-audio/rimebound/`
- Knockout/Lumen juice polish HELD

## Kits (every ability unique; numbers are stubs)
| id | name | role | passive | actives (key, cd) | SFX cues |
|---|---|---|---|---|---|
| survivor-pip | Pip Harlow | Survivor | CoreSpark: +25% thaw-core repair speed | FlareBlind (Q, 30s): flare blinds killer 2s in cone | sfx_pip_flare, sfx_pip_corespark |
| survivor-nell | Nell Okafor | Survivor | WarmHands: +40% revive speed | ThawKit (Q, 35s): cleanse slow/freeze on self+ally in 6 studs | sfx_nell_thawkit, sfx_nell_warmhands |
| survivor-juno | Juno Vale | Survivor | RidgeRunner: +30% sprint stamina, faster regen | IceGrapple (Q, 22s): 18-stud grapple to ledge · Slide (E, 12s): low-profile dash under obstacles | sfx_juno_grapple, sfx_juno_slide |
| killer-hullwarden | Hullwarden | Killer | IronHull: 25% stun/blind reduction | RimeHook (Q, 18s): chain pull 20 studs · ShatterSwing (M1 empowered, 10s): +1 damage, breaks pallets/ice | sfx_hullwarden_hook, sfx_hullwarden_shatter |
| killer-kettle | Kettle | Killer | CanaryEar: noise within 30 studs pings location | LanternSweep (Q, 25s): reveal survivors in 40° cone 3s · GasVent (E, 30s): vent cloud slows 30% for 4s | sfx_kettle_lantern, sfx_kettle_gasvent, sfx_kettle_canary |
| killer-whitepeak | Mrs. Whitepeak | Killer | ConciergeSmile: terror radius +20% and hidden while standing still | Whiteout (Q, 40s): 6s storm, survivor vision cut to 15 studs · CheckIn (E, 20s): place bell snare, roots 1.5s | sfx_whitepeak_whiteout, sfx_whitepeak_checkin |

## Lore
- **Pip Harlow** — Apprentice core-tender of the drowned shipyard, Pip still carries the spark-flint that lit the last warm furnace. Every core she touches remembers heat. The ice wants that memory gone, and it knows her name.
- **Nell Okafor** — Expedition medic who walked into the mines after the rescue team and never walked out. Her hands stay warm when nothing else does. She counts the frozen; she refuses to add to the count.
- **Juno Vale** — Ridge courier who ran messages between the resort and the shipyard before the whiteout. She knows every ledge and seam in the ice. Running is the only thing that has ever saved her — so far.
- **Hullwarden** — The shipyard's iron watchman, welded into his own hull-plate after the freeze. He drags the chain that once moored the last ship. Whatever escapes the yard, he hauls back.
- **Kettle** — A miner who kept a canary long after it went silent. He hears every footstep in the dark, and his lantern burns cold blue. The gas below never stopped rising; he made it his.
- **Mrs. Whitepeak** — Concierge of the Whitepeak Resort, who greets every guest — forever. Her smile never thaws. Check-in is mandatory. Check-out was never offered.

## Kit interface (GM1 loop calls)
```lua
Kit = { id, role, passive = {id, apply(player)}, actives = {{id, key, cooldown, cast(player, ctx)}},
  onRoundStart(player), onDowned(player), onRepairTick(player, core) -> mult,
  onReviveTick(player, target) -> mult, onHit(killer, victim) -> dmg, onStunned(player, dur) -> dur }
KitRegistry.get(kitId); KitRegistry.list(role)
```

## Lobby + character select + emotes (GM2)
`rimebound-lobby`: queue pad → role pick (3+ survivors / 1 killer per match) → character select grid (6 kits, skin preview `skin_<kitId>_default`) → ready → GM1 `Match.start(set)`.

| emote id | music | Sound cue |
|---|---|---|
| emote_wave | no | sfx_emote_wave |
| emote_shiver | no | sfx_emote_shiver |
| emote_campfire_jig | yes | mus_emote_campfire_jig |
| emote_icebox_dance | yes | mus_emote_icebox |
| emote_concierge_bow | yes | mus_emote_concierge |

Chase/terror cues: mus_chase_killer-hullwarden, mus_chase_killer-kettle, mus_chase_killer-whitepeak; mus_terror_<killerId>. Map BGM: mus_bgm_rimebound-<set>.

## Cosmetics
Skins `skin_<kitId>_default`. Cos1 = pip + hullwarden + kettle; Cos2 = nell + juno + whitepeak.
