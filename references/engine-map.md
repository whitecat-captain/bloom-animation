# Current engine map

Read this before mapping a reference image to data. The bundled Studio engine is `studio/components/flower/flowerScene.ts`, and the `FlowerConfig` type is `studio/components/flower/flowerConfig.ts`. Built-in flowers live under `studio/components/flower/generated/` and `studio/components/flower/presets/`; never add user flowers there. Persist user flowers through `scripts/upsert_flower.py`, which writes the shared `flowers.json` data store consumed by Studio at runtime.

## Reliable visual levers

| Reference feature | Engine controls | Notes |
|---|---|---|
| Density and layering | `numPetals`, `radius`, `radiusBias`, `height`, `heightBias`, `scaleInner` | Rebuilds the flower layout. Maximum 150 petals. |
| Flat, domed, or drooping silhouette | `height`, `tiltInner`, `outAngle`, `tiltBias` | Outer angle beyond 90 degrees can make the rim droop. |
| Long, rounded, lance, strap, or ruffled petals | `petalLen`, `w0` through `w4`, `waveAmp`, `asym` | All instances share one petal profile. |
| Scoop, roll, and curl | `curlOpen`, `curlBias`, `cup`, `sideCurl` | Update live without rebuilding layout. |
| Bud, half-open, or open state | `bloom`, `bloomMax`, `transition`, `curlClosed`, `wrapWidth`, `wrapCup`, `shellGap` | Also drives the bloom animation. |
| Natural irregularity and movement | `jitter`, `noiseAmp`, `noiseFreq`, `windAmp`, `windSpeed`, `windHeading` | Keep values restrained unless the reference calls for a stylized result. |
| Colour and surface style | five-stop palette, `flat` | The palette runs from outer rim to inner core. |
| Plant context | stem visibility, stem length, leaves | Simple supporting geometry only. |

## Existing visual seeds

- Aurora Rose: compact, domed, rounded-petal rosette.
- Blush Dahlia: dense rosette, narrow petals, open and slightly drooping rim.
- Garland Daisy: flat radiating bloom with strap-like rays and a warm disc.

## Known limits

- The engine renders one shared petal geometry in an instanced arrangement.
- It has no separate stamen, disc, lip, sepal, or second petal system.
- Use colour, density, scale, and openness to imply a centre; do not model a separate biological structure unless the engine is deliberately extended.
- Do not exceed 150 layout petals without a measured engine and performance change.
