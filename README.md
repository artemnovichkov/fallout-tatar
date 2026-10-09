# Fallout: Татарстан

Browser prototype of a Fallout 2-style RPG set in post-apocalyptic Tatarstan. Hero: Ravil.

**Play:** https://artemnovichkov.github.io/fallout-tatar/

## Controls
- LMB: act (walk / talk / loot / attack). RMB or click mode label: switch mode (move, attack, use, look).
- MMB drag: pan camera. Space: recenter (in combat: end turn). R: reload. Enter: end combat.
- I: inventory, C: character, P: Pip-Buy. 1-9: dialogue options. Esc: close.

## Dev
```sh
npm i
npm run dev
npm test
./tools/build_assets.sh   # regenerate pixel art (Python 3 + Pillow)
```

Stack: Vite, TypeScript, Phaser 3. Languages: Russian, Tatar.
