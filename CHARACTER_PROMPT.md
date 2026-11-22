# Operator character: prompt and delivery spec

The game currently uses a placeholder mannequin. You design the real operator; I load it, check it, and swap it in. The placeholder stays until your model passes the checks below.

## 1. Step one: a reference image (recommended)
Generate or draw this first, then use it as the input for image-to-3D. It gives a much more controlled result than text alone.

> Full-body character reference sheet of a desalination plant operator, front view and side view, on a plain light grey background, neutral relaxed A-pose (arms slightly away from the body, feet shoulder-width apart), looking straight ahead. Realistic proportions, about 7.5 heads tall, adult man in his thirties, friendly neutral expression, [skin tone and facial hair: your choice]. White safety hard hat with a short brim. Teal high-visibility safety vest with two thin silver reflective stripes over a light grey long-sleeve work shirt. Dark navy work trousers. Black steel-toe safety boots. No gloves, no tools, no props in the hands, no logos, no text. Soft even studio lighting, no dramatic shadows, photorealistic materials with clean fabric folds.

## 2. Step two: the 3D prompt
Use with text-to-3D, or add it as the text for image-to-3D together with the reference image.

> Realistic game-ready 3D character: a desalination plant operator, standing in a neutral A-pose, full body, facing forward. White safety hard hat with a short brim. Teal high-visibility safety vest with two thin silver reflective stripes over a light grey long-sleeve work shirt. Dark navy work trousers. Black steel-toe safety boots. Realistic proportions (about 7.5 heads tall), friendly neutral face, short dark hair visible under the hat. Clean topology, PBR textures, single character, no props in the hands, no logos or text, no cape or loose accessories.

Negative or avoid list, if the tool has one: cartoon, chibi, oversized head, hair cards, floating parts, weapons, extra limbs, backpack, text on clothes.

## 3. What I need back
| Item | Requirement |
|---|---|
| Format | GLB (single file, textures embedded) |
| Height | 1.75 m. If your tool exports at another scale, tell me; I can rescale |
| Axes | Y up. Origin between the feet, on the ground. Facing +Z (towards the viewer in a front view) |
| Pose | Neutral A-pose or T-pose |
| Triangles | Under about 15,000 (hard limit 25,000). Phones draw this character every frame |
| Textures | One to three materials, 1024 x 1024 each, 2048 at most for the head and torso together. Colour, normal and roughness maps |
| Rig | A humanoid skeleton (Mixamo-style bone names are best) |
| Animations | Looping in-place clips named exactly: `Idle`, `Walk`. Nice to have: `Press` (reach forward and press a button at chest height, about 1.5 s) and `Talk` (small hand gestures while standing) |
| Hard hat | Part of the mesh, or a separate named mesh `HardHat` so I can tint or hide it |

If your tool cannot rig or animate: send the unrigged GLB in A-pose. Rigging and a walk cycle can then be added with a rigging service such as Mixamo, which is free but needs an Adobe account, so you would do that download. I have not checked Mixamo's licence terms.

## 4. Licence: please send proof
Whatever tool you use, the game is public, so I need to know commercial use is allowed. Send me a screenshot or the text of the tool's licence or terms page for generated models and the plan you used (free plans often restrict commercial use or require credit). I will record it in `ASSETS.md` next to the model. If the terms are unclear, tell me and we decide before shipping.

## 5. What I do when it arrives
1. Put it in `public/assets/characters/operator/`, record source and licence in `ASSETS.md`.
2. Check height, axes, triangle count, texture sizes, skeleton and clip names.
3. Swap it in, keeping the placeholder as a fallback while it loads.
4. Run the automated checks and the independent verifier, and show you screenshots from the three game cameras before calling it done.
