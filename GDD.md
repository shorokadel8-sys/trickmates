# TRICKMATES — Game Design Document
*Online multiplayer couple prank game · starring Omar & Shorok · v1.0*

## 1. Reference analysis (visual source of truth)

| Reference | What it defines | How it is used in the game |
|---|---|---|
| **Shorok expression sheet** (9 faces) | Beige layered hijab, green eyes, warm peach skin, beige long-sleeve top. Expressions: happy, smiling, angry, worried, sad, scared, shocked, nervous, sneaky | 3D model colours/proportions; the sheet is cropped into HUD portraits that switch with gameplay emotion |
| **Omar expression sheet** (6 faces) | Brown wavy quiff, goatee + mustache, brown eyes, light-blue tee. Expressions: happy, angry, crying-sad, surprised, nervous, sneaky | Same: 3D model + live HUD portraits |
| **"The Fake Bug" gameplay storyboard** | Target in-game look: cozy office, warm lamp light, dark translucent rounded panels, warm yellow labels, Toolbox panel with item slot + "Use" button, prank info card (Prank / Object / Sequence / Reaction / Points / Risk / If caught) | Toolbox, prank card, colours (#f4c35a on rgba(30,24,20,.82)), the Fake Spider prank (150 pts, Low risk, "Oh mama! What's that?" / "Shorok, really?") |
| **House cutaway** | Dollhouse cutaway with 5 rooms: Home Office (top-left), Kitchen (top-middle), Living Room (top-right), **Bedroom** (bottom-left), Bathroom (bottom-right). Warm wood, beige walls, pendant lights | Exact room plan; **room 5 = Bedroom**. Cutaway walls so the camera sees inside, like the reference |

Props carried over from the references: "Good Things Take Time" poster, "Better Ideas Today" mug, cow plush on the desk, Design books, desk lamp, plants, pendant lights, beige sofas, tiled bathroom with tub + curtain.

## 2. Core concept
A playful, competitive battle between two people who know each other well. Both players are **simultaneously prankster and victim** inside their shared home. Each round you sneak around preparing harmless cartoon pranks, lure your partner into them, dodge theirs, and keep doing your chores. Highest score after 3 rounds wins.

**Pillars:** equal opportunity (every prank works for both) · readable cartoon comedy (big reactions, synced for both players) · cat-and-mouse tension (risk of being caught while preparing) · short sessions (≈8 min).

## 3. Players & characters
| | Omar | Shorok |
|---|---|---|
| Role | Player 1 (room creator by default) | Player 2 (joiner by default) |
| Look | Brown wavy hair, goatee & mustache, blue tee, dark trousers | Beige hijab, green eyes, beige long-sleeve top & trousers |
| Spawn | Home Office | Kitchen |
| Victim line style | "يا ماما! إيه ده؟" / "Oh mama! What's that?" | "عنكبوووت! يا عمر!" / "SPIDER! Omaaar!" |
| Catches partner | "شروق، بجد؟!" / "Shorok, really?" | "عمر، بجد؟!" / "Omar, really?" |

The room creator may pick either character; the joiner always gets the other one.

**Animation states (both characters):** idle, walk, run, interact, prepare (sneaky crouch), surprised, scared, laugh, angry, sad, embarrassed, victory, stunned.
**Facial expressions:** happy, angry, sad, surprised, scared, sneaky, embarrassed, laughing — eyes, lids, brows, mouth and blush blend per state; HUD portrait switches to the matching reference face.

## 4. The house (5 connected rooms)
```
 ┌──────── Office ───────┬──────── Kitchen ─────────┬──────── Living ─────────┐
 │ desk+laptop, chair,   │ fridge, stove, sink,     │ sofa, TV, coffee table, │
 │ bookshelf, lamp, cow  ═ prep counter (open)      ║ big plant, floor lamp   │
 └───door───┬────────────┴───────────────┬──────────┴──door──┬───────────────┘
 │        Bedroom                         │      Bathroom      │
 │ bed, nightstand+alarm, wardrobe,      door  mirror+sink, tub, shower,       │
 │ slippers, dresser                      │      towel rack, toilet            │
 └────────────────────────────────────────┴───────────────────┘
```
Loop route: Office → Kitchen → Living → Bathroom → Bedroom → Office, so chases and flanking are possible. 19 interactive hotspots.

## 5. Core loop
1. **Open Toolbox** (T) → browse by category (Scary, Funny, Surprise, Kitchen, Office, Hidden) → inspect item (room, object, risk, points, trigger) → **Select**.
2. **Walk to the target object** (prompt appears) → **hold E to prepare** (2–4 s sneaky animation). The risk meter shows how close your partner is.
3. Prank is **armed** (hidden from your partner; +20).
4. It **fires** on its trigger:
   - *Interact* — victim uses the object (e.g. doing a chore there).
   - *Proximity* — victim walks near it.
   - *Remote* — you press **Activate** when the victim is nearby (miss = −15).
5. Both screens play the same FX, the victim's scared/surprised reaction + speech bubble, the prankster's laugh. Victim is stunned 2.4 s. Prankster scores the prank's points.

**Counter-play:** Hold **F** at a suspicious object to *search*. Finding a hidden prank defuses it (+40 to you, −40 to the owner). Medium/High-risk pranks give a faint glint when the victim gets close.
**Getting caught:** if your partner is in the same room within the risk radius while you prepare (Low 2.8 m / Med 4 m / High 5.5 m) you're caught: preparation fails, −30 to you, +20 to them, "Shorok, really?".
**Chores:** each player always has 3 chores ("Wash the dishes", "Take a nap"…). Holding E at the object completes it (+15). Chores pull you into rooms — which is where traps wait.
**Distract (Q):** fake doorbell/phone in a chosen room. Partner gets a lure objective (+35 if they reach that room within 25 s). 40 s cooldown. Use it to pull them away while you prepare, or pull them into a trap.
**Emotes 1–4:** laugh, angry, sneaky, happy — synced.

## 6. Prank catalog (23 pranks — all playable by both characters)
| Room | Prank | Item | Object | Trigger | Risk | Pts |
|---|---|---|---|---|---|---|
| Office | The Fake Bug | Plastic Spider | Computer | Interact | Low | 150 |
| Office | Screen Crawler | Bug Screensaver USB | Computer | Remote | Med | 170 |
| Office | Desktop Surprise | Silly Wallpaper | Computer | Interact | Med | 180 |
| Office | Runaway Chair | Spinny Wheels | Desk Chair | Interact | Med | 160 |
| Office | Honk Book | Clown Horn | Bookshelf | Interact | Low | 120 |
| Kitchen | Rocket Surprise | Confetti Toy Rocket | Stove | Proximity | High | 220 |
| Kitchen | Sponge Donut | Fake Donut | Fridge | Interact | Low | 130 |
| Kitchen | Fridge Guest | Jack-in-the-box | Fridge | Interact | Med | 170 |
| Kitchen | Flour Power | Flour Puff Bag | Prep Counter | Interact | Med | 190 |
| Kitchen | Screaming Kettle | Whistle Cap | Stove | Remote | Low | 110 |
| Kitchen | Splash Zone | Sprayer Clip | Sink | Interact | Med | 160 |
| Living | Remote Control Trick | Spare Remote | TV | Remote | Low | 140 |
| Living | Sofa Surprise | Whoopee Cushion | Sofa | Interact | Low | 130 |
| Living | Hidden Roar | Mini Speaker | Coffee Table | Proximity | Med | 150 |
| Living | Disco Plant | Wiggle Motor | Big Plant | Interact | Med | 150 |
| Bathroom | Mirror Surprise | Window Marker | Mirror | Interact | Med | 170 |
| Bathroom | Unexpected Shower | Shower Timer | Shower | Proximity | Med | 170 |
| Bathroom | Towel Snake | Rubber Snake | Towel Rack | Interact | Low | 140 |
| Bathroom | Foam Explosion | Mega Bubble Bath | Bathtub | Interact | High | 230 |
| Bedroom | Alarm Blast | Rigged Alarm Clock | Nightstand | Remote | Low | 140 |
| Bedroom | Party Pillow | Confetti Popper | Bed | Interact | Med | 170 |
| Bedroom | Closet Dino | Inflatable Dinosaur | Wardrobe | Interact | High | 230 |
| Bedroom | Squeaky Steps | Squeakers | Slippers | Interact | Low | 120 |

Each prank defines: name, item, target object, room, preparation (hold time + sneaky anim), activation (trigger), interaction FX, victim reaction (emotion + bilingual line), risk, reward, and success/failure (fires on victim = success; defused / caught / remote miss = failure).
**Safety rule:** everything is toy-like and cartoonish — confetti rocket, foam, flour puffs, rubber snake, inflatable dino. No real hazards, no realistic weapons.

## 7. Scoring
| Event | Points |
|---|---|
| Prank armed | +20 |
| Prank fires on partner | +prank value (110–230) |
| Prepared unseen (partner never entered the room) | +25 |
| Chore completed | +15 |
| Reached lure room in time | +35 |
| Found & defused partner's prank | +40 (owner −40) |
| Caught partner preparing | +20 (preparer −30) |
| Remote activation missed | −15 |
| Challenges | +40 to +100 |

**Challenges** (each once per player per match): Kitchen Chaos, Ghost Mode, Grand Tour, Double Trouble, Sharp Eyes, Busy Bee.
**Limits:** max 3 armed pranks at once; each prank item usable once per round; one prank per object.

## 8. Match structure
3 rounds × 150 s, 7 s intermission (armed pranks cleared, toolbox restocked). Results screen: winner (victory/sad animations), final scores, pranks landed, defused, caught, chores, challenges. **Rematch** (both must accept) or **Main Menu**.

## 9. Online flow
Main Menu → Play Online → Create Private Room (pick character) → 5-letter invite code + copyable link → partner chooses Join Room and enters the code → lobby shows both players → host presses Start → house.
Disconnect: match pauses, 60 s to reconnect (same browser tab/session automatically retries); otherwise the remaining player wins by forfeit. Pause (Esc) pauses for both players; either can resume.

## 10. UI
- **Main menu:** TRICKMATES logo over the house cutaway art, Play Online, Create Private Room, Join Room, Characters, Settings.
- **HUD:** two player cards (live expression portrait, name, score), round + timer, current room, risk meter, chores list, challenge tracker, armed pranks with Activate buttons, interaction prompt, speech bubbles above heads, toast notifications.
- **Toolbox:** dark translucent rounded panel, item grid, category tabs, detail card (Prank / Object / Sequence / Reaction / Points / Risk / If caught) and **Use** button — matching the storyboard.
- **Pause, Settings** (volume, graphics quality, bilingual bubbles, camera zoom), **Results**.

## 11. Controls
WASD / arrows move · Shift run · E interact/prepare (hold) · F search (hold) · T toolbox · Q distract · 1–4 emotes · Esc pause · mouse wheel zoom · click floor to walk there. Touch: on-screen joystick + buttons.
