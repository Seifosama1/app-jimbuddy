// Jim Buddy — Exercise Library
// Images: Everkinetic series via Wikimedia Commons (CC BY-SA 3.0)
// URL pattern: https://commons.wikimedia.org/wiki/Special:FilePath/FILENAME

const W = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

const EXERCISE_LIBRARY = [
  // ─── CHEST ──────────────────────────────────────────────────────────────
  {
    id: 'bench-press', name: 'Bench Press', muscle: 'Chest', sets: 4, reps: 8, rest: 90,
    equipment: 'Barbell, Bench',
    description: 'The barbell bench press is a foundational compound lift targeting the pectoralis major, anterior deltoids, and triceps. One of the most effective upper-body strength builders.',
    equipmentNotes: 'Flat bench standard. Closer grip = more triceps, wider grip = more chest. Use a power rack or spotter for heavy sets.',
    instructions: [
      'Lie flat with eyes under the bar. Plant feet firmly.',
      'Grip just outside shoulder-width. Retract shoulder blades, slight arch.',
      'Unrack and hold bar directly over chest, arms extended.',
      'Inhale, lower bar in a controlled arc to your mid-chest.',
      'Press bar back up explosively to full extension.',
      'Re-rack after all reps. Exhale at the top of each rep.'
    ],
    images: [W + 'Bench-press-3-1.png', W + 'Bench-press-3-2.png']
  },
  {
    id: 'incline-bench', name: 'Incline Bench Press', muscle: 'Chest', sets: 3, reps: 10, rest: 90,
    equipment: 'Barbell, Incline Bench',
    description: 'Upper-chest focused press on a 30–45° incline bench. Hits the clavicular head of the pecs harder than flat bench.',
    equipmentNotes: 'Set bench to 30–45°. Too steep shifts emphasis to shoulders. Dumbbells give greater ROM.',
    instructions: [
      'Set bench to 30–45° incline. Lie back, plant feet.',
      'Grip barbell slightly wider than shoulder-width.',
      'Unrack and lower bar to upper chest in a controlled arc.',
      'Press back up to full extension. Exhale on the way up.'
    ],
    images: [W + 'Incline-bench-press-1.png', W + 'Incline-bench-press-2.png']
  },
  {
    id: 'decline-bench', name: 'Decline Bench Press', muscle: 'Chest', sets: 3, reps: 10, rest: 75,
    equipment: 'Barbell, Decline Bench',
    description: 'A lower-chest emphasising press performed on a decline bench. Reduces shoulder involvement and isolates the sternal head of the pectoralis major.',
    equipmentNotes: 'Secure your feet under the foot pads before lifting. A spotter is strongly recommended.',
    instructions: [
      'Secure feet, lie back on the decline bench.',
      'Grip barbell shoulder-width or slightly wider.',
      'Unrack and lower bar to lower chest.',
      'Press back up explosively to full arm extension.'
    ],
    images: [W + 'Decline-bench-press-2.png', W + 'Decline-dumbbell-bench-press-1.png']
  },
  {
    id: 'db-fly', name: 'Dumbbell Fly', muscle: 'Chest', sets: 3, reps: 12, rest: 60,
    equipment: 'Dumbbells, Flat Bench',
    description: 'An isolation movement that stretches and contracts the pectoralis major through a wide arc. Great for building chest width.',
    equipmentNotes: 'Keep a slight bend in the elbows throughout. Do not go too heavy — shoulder injury risk is high with sloppy form.',
    instructions: [
      'Lie flat on bench, dumbbells above chest, palms facing each other.',
      'Lower dumbbells in a wide arc until you feel a chest stretch.',
      'Keep elbows slightly bent at all times.',
      'Squeeze chest to bring dumbbells back to the start.'
    ],
    images: [W + 'Dumbbell-flys-1.png', W + 'Dumbbell-flys-2.png']
  },
  {
    id: 'push-up', name: 'Push-Up', muscle: 'Chest', sets: 4, reps: 20, rest: 60,
    equipment: 'None (bodyweight)',
    description: 'A classic bodyweight push movement that trains the chest, anterior deltoids, and triceps simultaneously. Endlessly scalable.',
    equipmentNotes: 'Wide hands = more chest. Narrow hands = more triceps. Elevate feet to increase difficulty.',
    instructions: [
      'Place hands slightly wider than shoulders, arms extended.',
      'Keep body in a straight line from head to heels.',
      'Lower chest to just above the floor.',
      'Push back up to full extension. Repeat.'
    ],
    images: ['https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif', 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif']
  },
  {
    id: 'cable-crossover', name: 'Cable Crossover', muscle: 'Chest', sets: 3, reps: 12, rest: 60,
    equipment: 'Cable Machine',
    description: 'A cable isolation exercise that maintains constant tension on the chest through the entire range of motion.',
    equipmentNotes: 'Adjust pulleys to high, mid, or low position to target different chest areas. Cross hands at the bottom for extra squeeze.',
    instructions: [
      'Set both pulleys high. Stand in the centre.',
      'Grab a handle in each hand, step forward.',
      'With slight elbow bend, bring hands together in an arc.',
      'Squeeze chest at the bottom, return slowly.'
    ],
    images: [W + 'Cable-crossover-1.png', W + 'Cable-crossover-2.png']
  },
  {
    id: 'chest-dip', name: 'Dip (Chest)', muscle: 'Chest', sets: 3, reps: 12, rest: 75,
    equipment: 'Parallel Bars / Dip Station',
    description: 'A compound bodyweight movement that targets the lower chest, triceps, and anterior deltoids when performed with a forward lean.',
    equipmentNotes: 'Lean torso forward to emphasise chest. Stay upright to shift focus to triceps. Add weight via belt for progression.',
    instructions: [
      'Grip parallel bars, jump up to support position.',
      'Lean torso slightly forward.',
      'Lower body until elbows reach 90°.',
      'Push back up to straight arms.'
    ],
    images: ['https://gymvisual.com/img/p/4/9/8/4/4984.gif',  'https://gymvisual.com/img/p/4/9/8/4/4984.gif']
  },
  {
    id: 'pec-deck', name: 'Pec Deck', muscle: 'Chest', sets: 3, reps: 15, rest: 60,
    equipment: 'Pec Deck Machine',
    description: 'A machine isolation exercise that trains the pectoralis major in the fly pattern with constant resistance and built-in safety.',
    equipmentNotes: 'Adjust seat so handles align with mid-chest. Keep elbows slightly bent and avoid hyper-extending the arms back.',
    instructions: [
      'Adjust seat height so handles are at chest level.',
      'Grip handles with elbows at 90°.',
      'Bring handles together squeezing the chest.',
      'Return slowly to the start position.'
    ],
    images: ['https://fitnessprogramer.com/wp-content/uploads/2021/02/Pec-Deck-Fly.gif', 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pec-Deck-Fly.gif']
  },

  // ─── BACK ───────────────────────────────────────────────────────────────
  {
    id: 'deadlift', name: 'Deadlift', muscle: 'Back', sets: 4, reps: 5, rest: 120,
    equipment: 'Barbell',
    description: 'The conventional deadlift is the king of posterior chain exercises. It builds the erectors, glutes, hamstrings, traps, and lats all at once.',
    equipmentNotes: 'Use chalk or straps for heavy sets. A belt helps brace your core at near-max loads. Flat shoes or deadlift slippers are ideal.',
    instructions: [
      'Stand with feet hip-width, bar over mid-foot.',
      'Hinge at hips, grip bar just outside legs.',
      'Brace core, chest up, bar close to shins.',
      'Drive through heels, extend hips and knees simultaneously.',
      'Stand tall at the top, hips fully locked.',
      'Hinge back down under control to return the bar.'
    ],
    images: [W + 'Dead-lifts-1.png', W + 'Dead-lifts-2.png']
  },
  {
    id: 'pull-up', name: 'Pull-Up', muscle: 'Back', sets: 4, reps: 8, rest: 90,
    equipment: 'Pull-Up Bar',
    description: 'The pull-up is a fundamental upper-body pulling movement that develops the latissimus dorsi, biceps, and rhomboids.',
    equipmentNotes: 'Overhand grip = pull-up (more lats). Underhand grip = chin-up (more biceps). Add weight via belt for progression.',
    instructions: [
      'Hang from bar with overhand grip, arms fully extended.',
      'Depress and retract shoulder blades to initiate.',
      'Pull chest toward bar, driving elbows down.',
      'Lower under control to full arm extension.'
    ],
    images: [ 'https://i.pinimg.com/originals/f6/40/12/f64012169c23b6be2a7f1823cac1db13.gif', 'https://i.pinimg.com/originals/f6/40/12/f64012169c23b6be2a7f1823cac1db13.gif']
  },
  {
    id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', sets: 3, reps: 10, rest: 75,
    equipment: 'Cable Machine, Wide-Grip Bar',
    description: 'A cable machine exercise that mimics the pull-up pattern. Great for building lat width and a V-taper.',
    equipmentNotes: 'Wide grip targets lats broadly. Close neutral grip allows heavier loads. Pull to upper chest, not behind neck.',
    instructions: [
      'Sit at the machine, secure thighs under pads.',
      'Grip bar wider than shoulder-width.',
      'Lean back slightly, pull bar to upper chest.',
      'Squeeze lats at the bottom, return slowly.'
    ],
    images: ['https://static.strengthlevel.com/images/exercises/lat-pulldown/howto/lat-pulldown-howto-1-800.jpg',  'https://static.strengthlevel.com/images/exercises/lat-pulldown/lat-pulldown-800.jpg']
  },
  {
    id: 'cable-row', name: 'Seated Cable Row', muscle: 'Back', sets: 3, reps: 10, rest: 75,
    equipment: 'Cable Machine, V-Bar',
    description: 'A horizontal pulling exercise that develops the mid-back, rhomboids, lats, and rear delts with constant cable tension.',
    equipmentNotes: 'Keep torso upright — do not swing. Pull to lower abdomen for more lat involvement, to upper abs for more rhomboids.',
    instructions: [
      'Sit at cable row station, feet on platform.',
      'Grip V-bar, straighten back, slight knee bend.',
      'Pull handle to lower abdomen, squeezing shoulder blades.',
      'Extend arms fully under control. Repeat.'
    ],
    images: [W + 'Cable-seated-rows-1.png', W + 'Cable-seated-rows-2.png']
  },
  {
    id: 'barbell-row', name: 'Barbell Row', muscle: 'Back', sets: 4, reps: 8, rest: 90,
    equipment: 'Barbell',
    description: 'The bent-over barbell row is a compound back mass builder that works the lats, rhomboids, traps, rear delts, and biceps.',
    equipmentNotes: 'Keep back roughly parallel to floor. Overhand grip hits upper back more; underhand grip engages biceps more.',
    instructions: [
      'Hip hinge until torso is near parallel to floor.',
      'Grip barbell shoulder-width, arms hanging straight.',
      'Row bar to lower chest / upper abdomen.',
      'Squeeze shoulder blades together at the top.',
      'Lower under control. Keep back flat throughout.'
    ],
    images: [W + 'Reverse-grip-bent-over-rows-1.png', W + 'Reverse-grip-bent-over-rows-2.png']
  },
  {
    id: 'db-row', name: 'Dumbbell Row', muscle: 'Back', sets: 3, reps: 12, rest: 60,
    equipment: 'Dumbbell, Flat Bench',
    description: 'A unilateral back exercise allowing a full range of motion. Targets the lats, rhomboids, and rear delt on one side at a time.',
    equipmentNotes: 'Brace your free hand on a bench. Pull elbow straight back past the hip for max lat activation.',
    instructions: [
      'Place one knee and hand on bench for support.',
      'Hold dumbbell in free hand, arm extended.',
      'Row dumbbell toward hip, elbow close to body.',
      'Lower under control. Complete reps, switch sides.'
    ],
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Rear_deltoid_row_dumbbell_1.svg/960px-Rear_deltoid_row_dumbbell_1.svg.png', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Rear_deltoid_row_dumbbell_2.svg/960px-Rear_deltoid_row_dumbbell_2.svg.png']
  },
  {
    id: 'tbar-row', name: 'T-Bar Row', muscle: 'Back', sets: 3, reps: 10, rest: 90,
    equipment: 'T-Bar Machine or Barbell in Corner',
    description: 'A compound back exercise that allows heavy loading with a neutral-ish grip. Excellent for back thickness.',
    equipmentNotes: 'Keep chest on pad if using a supported T-bar machine. Neutral grip reduces bicep fatigue vs. overhand.',
    instructions: [
      'Straddle the bar, grip handles.',
      'Hinge hips back, keep back flat.',
      'Row bar to chest, squeezing shoulder blades.',
      'Lower under control to full arm extension.'
    ],
    images: [W + 'T-bar-row-1.png', W + 'T-bar-row-2.png']
  },
  {
    id: 'chin-up', name: 'Chin-Up', muscle: 'Back', sets: 3, reps: 8, rest: 90,
    equipment: 'Pull-Up Bar',
    description: 'An underhand-grip pull-up variation that places more emphasis on the biceps while still developing the lats.',
    equipmentNotes: 'Shoulder-width underhand grip. Easier than pull-ups for most beginners due to greater bicep involvement.',
    instructions: [
      'Hang from bar with underhand grip, shoulder-width.',
      'Pull chest up toward bar.',
      'Squeeze at the top, lower under control.'
    ],
    images: [ 'https://fitnessprogramer.com/wp-content/uploads/2021/03/Chin-Up.gif',  'https://fitnessprogramer.com/wp-content/uploads/2021/03/Chin-Up.gif']
  },
  {
    id: 'hyperext', name: 'Hyperextension', muscle: 'Back', sets: 3, reps: 15, rest: 60,
    equipment: 'Hyperextension Bench',
    description: 'An isolation exercise for the lower back erectors, glutes, and hamstrings. Excellent for lower back health and injury prevention.',
    equipmentNotes: 'Keep movement controlled. Avoid rounding the lower back. Add a plate at the chest for extra load.',
    instructions: [
      'Lock ankles under the pads, hips on the pad.',
      'Cross arms at chest or hold a plate.',
      'Lower torso until near perpendicular to floor.',
      'Raise back up to parallel — do not hyper-arch.'
    ],
    images: [W + 'Hyperextensions-1.png', W + 'Hyperextensions-2.png']
  },{
  id: 'machine-lat-pulldown',
  name: 'Machine Lat Pulldown',
  muscle: 'Back',
  sets: 3,
  reps: 10,
  rest: 75,
  equipment: 'Lat Pulldown Machine (plate-loaded or selectorized)',
  description: 'A machine-based vertical pulling exercise that targets the latissimus dorsi, biceps, and rhomboids. The fixed movement path allows for a stable and controlled pull, often with a cam mechanism that provides resistance throughout the range of motion.',
  equipmentNotes: 'Adjust the thigh pad to secure your legs. Grip the bar wider than shoulder-width. Lean back slightly to engage the lats better. Pull to your upper chest, not behind your neck.',
  instructions: [
    'Sit at the machine, adjust the knee pad to hold your thighs down.',
    'Reach up and grip the bar with a wide overhand grip.',
    'Lean back about 10-15 degrees, brace your core.',
    'Pull the bar down to your upper chest, driving your elbows down and back.',
    'Squeeze your lats at the bottom, then slowly return the bar to the starting position with control.'
  ],
  images: ['https://gymvisual.com/img/p/5/3/1/6/5316.gif','https://gymvisual.com/img/p/5/3/1/6/5316.gif']
},{
  id: 'one-arm-cable-row',
  name: 'One-Arm Cable Row',
  muscle: 'Back',
  sets: 3,
  reps: 12,
  rest: 60,
  equipment: 'Cable Machine, Single Handle or D-Handle',
  description: 'A unilateral horizontal pulling exercise that targets the latissimus dorsi, rhomboids, rear deltoids, and biceps. Performing it one arm at a time allows for a greater range of motion, a stronger contraction, and helps correct left-to-right strength imbalances.',
  equipmentNotes: 'Set the pulley to the lowest position. Use a single handle or D-handle. Keep your torso upright or slightly leaning forward. Focus on pulling the elbow straight back past your hip for maximum lat activation.',
  instructions: [
    'Attach a handle to the low pulley. Stand facing the machine, feet shoulder-width apart.',
    'Grab the handle with one hand, step back to create tension, and stagger your feet for stability.',
    'With a slight bend in your knees and a flat back, pull the handle toward your lower abdomen, driving your elbow straight back.',
    'Squeeze your back muscles at the end of the movement, feeling a strong contraction in your lat.',
    'Slowly extend your arm forward under control, feeling a stretch in your lat, and repeat for the desired reps before switching sides.'
  ],
  images: ['https://gymvisual.com/img/p/3/8/0/4/2/38042.gif','https://gymvisual.com/img/p/3/8/0/4/2/38042.gif']
},

  // ─── SHOULDERS ──────────────────────────────────────────────────────────
  {
    id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', sets: 4, reps: 8, rest: 90,
    equipment: 'Barbell',
    description: 'The barbell overhead press is the primary shoulder strength movement. It develops the anterior and lateral deltoids, upper traps, and triceps.',
    equipmentNotes: 'Press from a rack at chin height. Keep core braced and glutes squeezed. Do not flare elbows excessively.',
    instructions: [
      'Set bar on rack at chin height. Grip just outside shoulders.',
      'Brace core and squeeze glutes.',
      'Press bar straight overhead, head moves back slightly to let bar pass.',
      'Lock out at top, bar directly over heels.',
      'Lower under control back to collarbone.'
    ],
    images: [W + 'Seated-military-shoulder-press-1.png', W + 'Seated-military-shoulder-press-2.png']
  },
  {
    id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders', sets: 4, reps: 15, rest: 45,
    equipment: 'Dumbbells',
    description: 'An isolation exercise for the lateral deltoid. The primary driver of shoulder width.',
    equipmentNotes: 'Lead with elbows, not wrists. Slight forward lean increases lateral delt activation. Avoid using momentum.',
    instructions: [
      'Hold dumbbells at sides, slight bend in elbows.',
      'Raise arms out to the side to shoulder height.',
      'Lead with elbows, pinky slightly higher than thumb.',
      'Lower under control.'
    ],
    images: [W + 'Dumbbell-lateral-raises-1.png', W + 'Dumbbell-lateral-raises-2.png']
  },
  {
    id: 'front-raise', name: 'Front Raise', muscle: 'Shoulders', sets: 3, reps: 12, rest: 45,
    equipment: 'Dumbbells or Barbell',
    description: 'An isolation lift for the anterior deltoid.',
    equipmentNotes: 'Can be performed alternating or both arms simultaneously. Plates or cables also work well.',
    instructions: [
      'Hold dumbbells in front of thighs, palms facing down.',
      'Raise both arms straight in front to shoulder height.',
      'Keep slight bend in elbows. Lower under control.'
    ],
    images: ['https://pelank.com/wp-content/uploads/2025/12/Alternating-Dumbbell-Front-Raise.gif', 'https://pelank.com/wp-content/uploads/2025/12/Alternating-Dumbbell-Front-Raise.gif']
  },
  {
    id: 'arnold-press', name: 'Arnold Press', muscle: 'Shoulders', sets: 3, reps: 10, rest: 75,
    equipment: 'Dumbbells, Bench (with back support)',
    description: 'A shoulder press variation with rotation that hits all three deltoid heads through a greater range of motion.',
    equipmentNotes: 'Start with palms facing you, rotate to face forward as you press up. Control the rotation.',
    instructions: [
      'Sit with dumbbells at shoulder height, palms facing you.',
      'Press up while rotating palms to face forward.',
      'At the top, arms are extended with palms forward.',
      'Reverse the rotation as you lower back down.'
    ],
    images: [ 'https://thumbs.dreamstime.com/b/dumbbell-shoulder-arnold-press-anatomy-fitness-bodybuilding-target-muscles-marked-red-126728017.jpg', 'https://www.shutterstock.com/shutterstock/videos/1016791639/thumb/1.jpg?ip=x480']
  },
  {
    id: 'face-pull', name: 'Face Pull', muscle: 'Shoulders', sets: 3, reps: 15, rest: 45,
    equipment: 'Cable Machine, Rope Attachment',
    description: 'A rear-delt and rotator cuff strengthener. Excellent for shoulder health and posture correction.',
    equipmentNotes: 'Set pulley at head height. Use rope attachment and pull to face, externally rotating at end. Keep elbows high.',
    instructions: [
      'Attach rope to high pulley. Stand facing the machine.',
      'Grip rope with both hands, step back.',
      'Pull rope toward face, separating hands at your ears.',
      'Externally rotate at the end. Return slowly.'
    ],
    images: [ 'https://s3assets.skimble.com/assets/1852453/image_full.jpg', 'https://s3assets.skimble.com/assets/1682829/image_iphone.jpg']
  },
  {
    id: 'upright-row', name: 'Upright Row', muscle: 'Shoulders', sets: 3, reps: 12, rest: 60,
    equipment: 'Barbell or Dumbbells',
    description: 'A vertical pulling movement that trains the upper traps and lateral deltoids.',
    equipmentNotes: 'Use a wider grip to reduce shoulder impingement risk. Avoid pulling past chin height.',
    instructions: [
      'Hold barbell with overhand grip, hands hip-width.',
      'Pull bar straight up along body to chin height.',
      'Keep elbows flared out and above hands.',
      'Lower bar under control.'
    ],
    images: [W + 'Barbell-upright-rows-1.png', W + 'Barbell-upright-rows-2.png']
  },
  {
    id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle: 'Shoulders', sets: 3, reps: 15, rest: 45,
    equipment: 'Dumbbells or Pec Deck (reverse)',
    description: 'An isolation exercise for the posterior deltoid. Critical for balanced shoulder development and posture.',
    equipmentNotes: 'Can be done bent-over, lying face-down on an incline bench, or on a reverse pec deck.',
    instructions: [
      'Hinge forward or lie prone on incline bench.',
      'Hold dumbbells hanging down, slight elbow bend.',
      'Raise arms out to the side in a wide arc.',
      'Squeeze rear delts at the top. Lower slowly.'
    ],
    images: [ 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQRiJYqE5MWSPG778adhC1KDMqgCMfgAqa9REgupfjd2A&s',
        'https://i.ytimg.com/vi/Ce4ifnVg7yg/maxresdefault.jpg']
  },

  // ─── LEGS ────────────────────────────────────────────────────────────────
  {
    id: 'squat', name: 'Squat', muscle: 'Legs', sets: 4, reps: 8, rest: 120,
    equipment: 'Barbell, Squat Rack',
    description: 'The barbell back squat is the king of lower-body exercises. It builds the quads, glutes, hamstrings, core, and lower back simultaneously.',
    equipmentNotes: 'High bar = more quad dominant. Low bar = more hip/glute dominant. Use a belt and knee sleeves for heavy sets.',
    instructions: [
      'Set bar on upper traps (high bar) or rear delts (low bar).',
      'Stand shoulder-width, toes slightly out.',
      'Brace core, chest up, unrack and step back.',
      'Break at hips and knees simultaneously, squat to parallel or below.',
      'Drive through heels, stand back up.',
      'Re-rack after all reps.'
    ],
    images: [W + 'Squats-1.png', W + 'Squats-2.png']
  },
  {
    id: 'leg-press', name: 'Leg Press', muscle: 'Legs', sets: 3, reps: 12, rest: 90,
    equipment: '45° Leg Press Machine',
    description: 'A compound machine exercise for the quads, glutes, and hamstrings. Allows heavy loading with reduced spinal stress.',
    equipmentNotes: 'Foot placement matters: high & wide = more glutes/hamstrings. Low & narrow = more quads. Never lock knees fully.',
    instructions: [
      'Sit in machine, feet shoulder-width on platform.',
      'Release safety handles and lower weight.',
      'Lower until knees reach 90°.',
      'Press platform back up, stop just short of lockout.'
    ],
    images: [W + 'Leg-press-1-1024x670.png', W + 'Leg-press-2-1024x670.png']
  },
  {
    id: 'rdl', name: 'Romanian Deadlift', muscle: 'Legs', sets: 3, reps: 10, rest: 90,
    equipment: 'Barbell or Dumbbells',
    description: 'A hip hinge movement that isolates the hamstrings and glutes through a deep stretch. One of the best posterior chain builders.',
    equipmentNotes: 'Soft bend in knees throughout. Lower bar to mid-shin range keeping it close to legs. Feel the hamstring stretch.',
    instructions: [
      'Hold bar in front of thighs, shoulder-width grip.',
      'Push hips back, hinge forward keeping back flat.',
      'Lower bar along legs until hamstrings are fully stretched.',
      'Drive hips forward to stand back up.'
    ],
    images: [W + 'Romanian-deadlift-1.png', W + 'Romanian-deadlift-2.png']
  },
  {
    id: 'leg-curl', name: 'Leg Curl', muscle: 'Legs', sets: 3, reps: 12, rest: 60,
    equipment: 'Lying or Seated Leg Curl Machine',
    description: 'An isolation exercise for the hamstrings. Essential for balanced quad-to-hamstring strength.',
    equipmentNotes: 'Point toes for more biceps femoris activation. Full range of motion matters.',
    instructions: [
      'Lie prone on machine, heels under pad.',
      'Curl heels toward glutes as far as possible.',
      'Squeeze hamstrings at the top.',
      'Lower under control to full extension.'
    ],
    images: ['https://media.tenor.com/ZElx6PviDq0AAAAM/gym.gif', 'https://media.tenor.com/ZElx6PviDq0AAAAM/gym.gif']
  },
  {
    id: 'leg-ext', name: 'Leg Extension', muscle: 'Legs', sets: 3, reps: 15, rest: 60,
    equipment: 'Leg Extension Machine',
    description: 'A quad isolation machine that trains the knee extension movement. Best used as a finishing exercise after compound work.',
    equipmentNotes: 'Extend fully for complete quad activation. Controlled lowering builds quad strength through the full range.',
    instructions: [
      'Sit in machine, shins behind pad.',
      'Extend legs until fully straight.',
      'Hold for a second at the top.',
      'Lower slowly under control.'
    ],
    images: ['https://fitnessprogramer.com/wp-content/uploads/2021/02/LEG-EXTENSION.gif', 'https://fitnessprogramer.com/wp-content/uploads/2021/02/LEG-EXTENSION.gif']
  },
  {
    id: 'calf-raise', name: 'Calf Raise', muscle: 'Legs', sets: 4, reps: 20, rest: 45,
    equipment: 'Calf Raise Machine or Step',
    description: 'An isolation exercise for the gastrocnemius and soleus. Calves respond well to high reps and full range of motion.',
    equipmentNotes: 'Go through full range — deep stretch at the bottom, full contraction at top. Pause at both ends.',
    instructions: [
      'Stand with balls of feet on edge of step or platform.',
      'Lower heels for a full calf stretch.',
      'Rise up as high as possible on toes.',
      'Hold at top, lower slowly.'
    ],
    images: ['https://i.pinimg.com/originals/2f/7c/ca/2f7cca8d37c65384c1d0bd84cc0a91d1.gif', 'https://i.pinimg.com/originals/2f/7c/ca/2f7cca8d37c65384c1d0bd84cc0a91d1.gif']
  },
  {
    id: 'hack-squat', name: 'Hack Squat', muscle: 'Legs', sets: 3, reps: 10, rest: 90,
    equipment: 'Hack Squat Machine',
    description: 'A machine squat that places more emphasis on the quads than the back squat due to the fixed movement path.',
    equipmentNotes: 'Feet placement lower on platform = more quad. Higher = more glutes. Keep heels down throughout.',
    instructions: [
      'Load the machine, position shoulders under pads.',
      'Stand with feet shoulder-width on platform.',
      'Release safety, squat down to 90°.',
      'Drive up through the whole foot to return.'
    ],
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Narrow-stance-hack-squats-1-1024x721.png/960px-Narrow-stance-hack-squats-1-1024x721.png', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Narrow-stance-hack-squats-2-1024x721.png/960px-Narrow-stance-hack-squats-2-1024x721.png']
  },
  {
    id: 'lunges', name: 'Lunges', muscle: 'Legs', sets: 3, reps: 12, rest: 60,
    equipment: 'Bodyweight or Dumbbells',
    description: 'A unilateral leg exercise that trains quads, glutes, and hamstrings while improving balance and coordination.',
    equipmentNotes: 'Front knee should not pass toes. Long stride = more glutes, short stride = more quads.',
    instructions: [
      'Stand tall, step one foot forward.',
      'Lower back knee toward the floor.',
      'Keep front shin vertical.',
      'Push off front foot to return to start. Alternate legs.'
    ],
    images: [W + 'Lunges-1.png', W + 'Lunges-2.png']
  },
  {
    id: 'bulgarian-squat', name: 'Bulgarian Split Squat', muscle: 'Legs', sets: 3, reps: 10, rest: 75,
    equipment: 'Dumbbells or Barbell, Bench',
    description: 'One of the most effective unilateral leg exercises. Builds quads and glutes with serious hip flexor stretch.',
    equipmentNotes: 'Rear foot elevated on a bench. Control the descent — this is very demanding on balance.',
    instructions: [
      'Place rear foot on bench behind you.',
      'Hold dumbbells at sides.',
      'Lower back knee toward the floor.',
      'Push through front heel to stand up. Complete reps then switch.'
    ],
    images: ['https://static.wixstatic.com/media/2edbed_a22c381055474b6d805f80fbae76182b~mv2.gif','https://static.wixstatic.com/media/2edbed_a22c381055474b6d805f80fbae76182b~mv2.gif']
  },
  {
    id: 'sumo-deadlift', name: 'Sumo Deadlift', muscle: 'Legs', sets: 4, reps: 6, rest: 120,
    equipment: 'Barbell',
    description: 'A deadlift variation with a wide stance that emphasises the glutes, hip adductors, and quads more than conventional.',
    equipmentNotes: 'Wide stance, toes pointing 45° out. Grip inside the legs. Keep chest tall and hips low at the start.',
    instructions: [
      'Wide stance, toes out 45°, bar over mid-foot.',
      'Grip bar inside legs, hinge down.',
      'Chest up, hips low, drive knees out.',
      'Drive through floor, extending hips and knees.',
      'Stand tall at the top.'
    ],
    images: [W + 'Dead-lifts-1.png', W + 'Dead-lifts-2.png']
  },

  // ─── ARMS ────────────────────────────────────────────────────────────────
  {
    id: 'barbell-curl', name: 'Barbell Curl', muscle: 'Arms', sets: 3, reps: 10, rest: 60,
    equipment: 'Barbell or EZ-Bar',
    description: 'The barbell curl is the foundational bicep mass builder. An EZ-bar reduces wrist strain while maintaining full bicep activation.',
    equipmentNotes: 'Keep elbows pinned to sides. Do not swing — use strict form for maximum activation.',
    instructions: [
      'Hold barbell with underhand shoulder-width grip.',
      'Pin elbows to sides, stand tall.',
      'Curl bar up toward shoulders.',
      'Squeeze biceps at top, lower slowly.'
    ],
    images: [ 'https://fitliferegime.com/wp-content/uploads/2023/06/Barbell-Bicep-Curl.gif',  'https://fitliferegime.com/wp-content/uploads/2023/06/Barbell-Bicep-Curl.gif']
  },
  {
    id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 45,
    equipment: 'Dumbbells',
    description: 'A neutral-grip curl variation that targets the brachialis and brachioradialis along with the biceps. Great for arm thickness.',
    equipmentNotes: 'Neutral (thumbs up) grip throughout. Can be performed alternating or simultaneously.',
    instructions: [
      'Hold dumbbells at sides, palms facing each other.',
      'Curl both dumbbells up without rotating wrists.',
      'Keep elbows stationary.',
      'Lower under control.'
    ],
    images: [W + 'Bicep-hammer-curl-1.png', W + 'Bicep-hammer-curl-2.png']
  },
  {
    id: 'tricep-pushdown', name: 'Tricep Pushdown', muscle: 'Arms', sets: 3, reps: 12, rest: 60,
    equipment: 'Cable Machine, Straight Bar or Rope',
    description: 'A cable isolation exercise for the triceps. The rope attachment allows full elbow extension and a wider range of motion.',
    equipmentNotes: 'Keep elbows pinned to sides. Flare hands out at the bottom with the rope for full tricep contraction.',
    instructions: [
      'Attach rope to high pulley. Face the machine.',
      'Grip rope, elbows at sides.',
      'Push down until arms fully extended.',
      'Flare hands apart at the bottom for full contraction.',
      'Return slowly.'
    ],
    images: [W + 'Triceps-pushdown-with-v-bar-1.gif', W + 'Triceps-pushdown-with-v-bar-2.gif']
  },
  {
    id: 'skull-crusher', name: 'Skull Crusher', muscle: 'Arms', sets: 3, reps: 10, rest: 60,
    equipment: 'EZ-Bar or Dumbbells, Flat Bench',
    description: 'A lying tricep extension exercise that isolates all three tricep heads through a long stretch.',
    equipmentNotes: 'Lower bar to forehead or slightly behind head. Keep elbows pointed at ceiling and stationary.',
    instructions: [
      'Lie flat on bench, hold EZ-bar over chest.',
      'Keep upper arms vertical and stationary.',
      'Lower bar toward forehead by bending elbows.',
      'Extend arms to full lockout.'
    ],
    images: [W + 'Decline-close-grip-bench-to-skull-crusher-1.png', W + 'Decline-close-grip-bench-to-skull-crusher-2.png']
  },
  {
    id: 'preacher-curl', name: 'Preacher Curl', muscle: 'Arms', sets: 3, reps: 10, rest: 60,
    equipment: 'EZ-Bar or Dumbbells, Preacher Bench',
    description: 'A strict curl variation performed on a preacher bench that eliminates cheating and maximises bicep peak contraction.',
    equipmentNotes: 'Do not let the bar bounce at the bottom. Full extension at the bottom is important for the long head of the bicep.',
    instructions: [
      'Sit at preacher bench, upper arms resting on pad.',
      'Hold EZ-bar with underhand grip.',
      'Curl bar up squeezing biceps hard at top.',
      'Lower slowly to full extension.'
    ],
    images: [ 'https://media.tenor.com/m2Dfyh507FQAAAAd/8preacher-curl.gif',  'https://media.tenor.com/m2Dfyh507FQAAAAd/8preacher-curl.gif']
  },
  {
    id: 'tricep-dip', name: 'Tricep Dip', muscle: 'Arms', sets: 3, reps: 15, rest: 60,
    equipment: 'Parallel Bars or Bench',
    description: 'A compound tricep exercise using bodyweight. Staying upright shifts emphasis firmly onto the triceps.',
    equipmentNotes: 'Keep torso upright to target triceps. Hands on a bench behind you for a beginner variation.',
    instructions: [
      'Grip parallel bars, torso upright.',
      'Lower body until elbows reach 90°.',
      'Push back up to straight arms.'
    ],
    images: ['https://gymvisual.com/img/p/4/9/8/4/4984.gif',  'https://gymvisual.com/img/p/4/9/8/4/4984.gif']
  },
  {
    id: 'incline-curl', name: 'Incline Dumbbell Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 45,
    equipment: 'Dumbbells, Incline Bench',
    description: 'A bicep stretch-focused curl targeting the long head of the bicep for peak development.',
    equipmentNotes: 'Allow arms to hang fully straight behind you. Slow eccentric for maximum long-head stretch.',
    instructions: [
      'Sit on incline bench (~60°), arms hanging behind.',
      'Curl dumbbells up alternating or together.',
      'Squeeze at top, lower all the way back down.'
    ],
    images: ['https://fitnessprogramer.com/wp-content/uploads/2022/02/Flexor-Incline-Dumbbell-Curls.gif', 'https://fitnessprogramer.com/wp-content/uploads/2022/02/Flexor-Incline-Dumbbell-Curls.gif']
  },
  {
    id: 'overhead-tri-ext', name: 'Overhead Tricep Ext.', muscle: 'Arms', sets: 3, reps: 12, rest: 45,
    equipment: 'Dumbbell or Cable, Rope',
    description: 'An overhead tricep stretch exercise that targets the long head through a full range.',
    equipmentNotes: 'Keep elbows close to ears. Can use a single dumbbell, EZ-bar, or cable with rope attachment.',
    instructions: [
      'Hold dumbbell overhead with both hands.',
      'Keep upper arms close to ears.',
      'Lower dumbbell behind head by bending elbows.',
      'Extend arms back to full lockout overhead.'
    ],
    images: ['https://gymvisual.com/img/p/2/7/3/4/2/27342.gif', 'https://gymvisual.com/img/p/2/7/3/4/2/27342.gif']
  },
  {
    id: 'concentration-curl', name: 'Concentration Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 45,
    equipment: 'Dumbbell, Bench',
    description: 'A highly isolated bicep curl performed seated with elbow braced against the inner thigh. Maximises the bicep peak.',
    equipmentNotes: 'Sit, brace elbow on inner thigh. Full range of motion. No swinging at all.',
    instructions: [
      'Sit on bench, legs apart, lean forward.',
      'Rest elbow on inner thigh, dumbbell hanging.',
      'Curl dumbbell up, squeeze hard at top.',
      'Lower slowly to full extension.'
    ],
    images: [W + 'Concentration-curls-1.png', W + 'Concentration-curls-2.png']
  },{
  id: 'wrist-curl',
  name: 'Wrist Curl',
  muscle: 'Arms',
  sets: 3,
  reps: 15,
  rest: 45,
  equipment: 'Barbell or Dumbbell',
  description: 'An isolation exercise for the forearm flexors, crucial for developing grip strength and overall arm thickness.',
  equipmentNotes: 'Rest your forearms on your thighs or a bench with your wrists hanging off the edge. Let the weight roll down to your fingertips before curling it back up.',
  instructions: [
    'Sit on a bench and rest your forearms on your thighs, with your wrists hanging over your knees.',
    'Hold a barbell or dumbbell with an underhand grip.',
    'Curl the weight up by flexing your wrists.',
    'Lower the weight back down, letting it roll to your fingertips for a full stretch.'
  ],
  images: ['https://gymvisual.com/img/p/5/1/4/2/5142.gif','https://gymvisual.com/img/p/5/1/4/2/5142.gif']
},
{
  id: 'reverse-wrist-curl',
  name: 'Reverse Wrist Curl',
  muscle: 'Arms',
  sets: 3,
  reps: 15,
  rest: 45,
  equipment: 'Barbell or Dumbbell',
  description: 'An isolation exercise for the forearm extensors. Important for muscle balance and preventing injuries like tennis elbow.',
  equipmentNotes: 'Same setup as the wrist curl, but use an overhand grip.',
  instructions: [
    'Sit on a bench and rest your forearms on your thighs, with your wrists hanging over your knees.',
    'Hold a barbell or dumbbell with an overhand grip.',
    'Extend your wrists upward, raising the weight.',
    'Lower the weight back down under control.'
  ],
  images: ['https://i.pinimg.com/originals/e0/1c/03/e01c0321ec979b22c6ac74c11567c313.gif','https://i.pinimg.com/originals/e0/1c/03/e01c0321ec979b22c6ac74c11567c313.gif']
},

  // ─── CORE ────────────────────────────────────────────────────────────────
  {
    id: 'plank', name: 'Plank', muscle: 'Core', sets: 3, reps: 60, rest: 60,
    equipment: 'None (bodyweight)',
    description: 'A foundational isometric core exercise that builds anti-extension strength. Trains the entire anterior core and shoulder girdle.',
    equipmentNotes: 'Keep hips level. Squeeze glutes and quads. Breathe steadily.',
    instructions: [
      'Forearms on floor, elbows under shoulders.',
      'Body in a straight line from head to heels.',
      'Brace core, squeeze glutes.',
      'Hold the position for the target time.',
      'Breathe steadily throughout.'
    ],
    images: ['https://gymvisual.com/19925-large_default/plank-to-pike.jpg', 'https://gymvisual.com/19925-large_default/plank-to-pike.jpg']
  },
  {
    id: 'crunches', name: 'Crunches', muscle: 'Core', sets: 4, reps: 20, rest: 45,
    equipment: 'None (bodyweight)',
    description: 'The classic abdominal exercise. Targets the rectus abdominis through spinal flexion.',
    equipmentNotes: 'Do not pull on your neck. Focus on curling the ribs toward the pelvis.',
    instructions: [
      'Lie on back, knees bent, feet flat.',
      'Hands behind head lightly.',
      'Curl shoulders toward knees — ribs to pelvis.',
      'Lower back down under control.'
    ],
    images: [W + 'Crunches-1.png', W + 'Crunches-2.png']
  },
  {
    id: 'russian-twist', name: 'Russian Twist', muscle: 'Core', sets: 3, reps: 20, rest: 45,
    equipment: 'None or Weight Plate / Dumbbell',
    description: 'A rotational core exercise that targets the obliques. Can be loaded with a plate or medicine ball for extra challenge.',
    equipmentNotes: 'Lean back ~45° for maximum oblique activation. Tap the floor on each side to complete one rep.',
    instructions: [
      'Sit with knees bent, feet raised off floor.',
      'Lean back at ~45°, hold hands together.',
      'Rotate torso to the right, touch floor.',
      'Rotate to the left. That\'s one rep.'
    ],
    images: ['https://gymvisual.com/img/p/1/0/2/9/8/10298.gif',  'https://gymvisual.com/img/p/1/0/2/9/8/10298.gif']
  },
  {
    id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle: 'Core', sets: 3, reps: 12, rest: 60,
    equipment: 'Pull-Up Bar',
    description: 'An advanced core exercise that targets the lower abs and hip flexors through leg raise from a dead hang.',
    equipmentNotes: 'Keep legs as straight as possible. Avoid swinging.',
    instructions: [
      'Hang from a pull-up bar, arms fully extended.',
      'Keeping legs straight, raise them to 90° or higher.',
      'Hold briefly at the top.',
      'Lower legs under control.'
    ],
    images: [ 'https://gymvisual.com/img/p/5/2/1/1/5211.gif', 'https://gymvisual.com/img/p/5/2/1/1/5211.gif']
  },
  {
    id: 'ab-rollout', name: 'Ab Rollout', muscle: 'Core', sets: 3, reps: 10, rest: 60,
    equipment: 'Ab Wheel',
    description: 'One of the most challenging anti-extension core exercises. Trains the entire core, lats, and shoulder stabilisers.',
    equipmentNotes: 'Start from knees. Only extend as far as you can control.',
    instructions: [
      'Kneel on the floor, grip ab wheel.',
      'Roll forward keeping core braced.',
      'Extend as far as you can control.',
      'Roll back by contracting abs.'
    ],
    images: [ 'https://i.pinimg.com/originals/36/bc/a1/36bca1aa357e66f329107fe5da9bfb98.gif',  'https://i.pinimg.com/originals/36/bc/a1/36bca1aa357e66f329107fe5da9bfb98.gif']
  },
  {
    id: 'bicycle-crunch', name: 'Bicycle Crunch', muscle: 'Core', sets: 3, reps: 20, rest: 45,
    equipment: 'None (bodyweight)',
    description: 'A dynamic crunch variation that activates both the rectus abdominis and the obliques simultaneously.',
    equipmentNotes: 'Slow and controlled beats fast and sloppy. Full rotation with elbow toward opposite knee.',
    instructions: [
      'Lie on back, hands behind head.',
      'Bring opposite elbow to opposite knee.',
      'Extend the other leg straight.',
      'Alternate sides in a pedalling motion.'
    ],
    images: [ 'https://newlife.com.cy/wp-content/uploads/2019/02/00031301-air-bike-m_waist_FIX_360.gif',  'https://newlife.com.cy/wp-content/uploads/2019/02/00031301-air-bike-m_waist_FIX_360.gif']
  },
  {
    id: 'leg-raise', name: 'Lying Leg Raise', muscle: 'Core', sets: 3, reps: 15, rest: 45,
    equipment: 'None (bodyweight)',
    description: 'A lower ab isolation exercise performed lying flat.',
    equipmentNotes: 'Press lower back into the floor throughout.',
    instructions: [
      'Lie flat, hands at sides or under glutes.',
      'Raise legs to 90° keeping them straight.',
      'Lower slowly without touching the floor.',
      'Raise again before they land.'
    ],
    images: [W + 'Bent-knee-hip-raise-1.png', W + 'Bent-knee-hip-raise-2.png']
  },
  {
    id: 'cable-crunch', name: 'Cable Crunch', muscle: 'Core', sets: 3, reps: 15, rest: 45,
    equipment: 'Cable Machine, Rope Attachment',
    description: 'A weighted crunch using a cable that allows progressive overload on the abs.',
    equipmentNotes: 'Kneel facing the machine. Pull with abs, not arms. Hips stay stationary.',
    instructions: [
      'Attach rope to high pulley. Kneel in front.',
      'Hold rope at ears, hips back.',
      'Crunch ribs toward hips — abs do the work.',
      'Return slowly to start.'
    ],
    images: ['https://fitnessprogramer.com/wp-content/uploads/2021/09/Standing-Cable-Crunch.gif',  'https://fitnessprogramer.com/wp-content/uploads/2021/09/Standing-Cable-Crunch.gif']
  },

  // ─── CHEST (extra) ───────────────────────────────────────────────────────
  {
    id: 'db-press', name: 'Dumbbell Bench Press', muscle: 'Chest', sets: 4, reps: 8, rest: 90,
    equipment: 'Dumbbells, Flat Bench',
    description: 'A dumbbell variation of the bench press allowing greater range of motion and independent arm movement.',
    equipmentNotes: 'Dumbbells allow arms to travel lower than a barbell, increasing pec stretch. Great for correcting imbalances.',
    instructions: [
      'Lie flat on bench, dumbbells at chest level.',
      'Press dumbbells up to full extension.',
      'Lower in a controlled arc to full stretch.',
      'Keep wrists straight throughout.'
    ],
    images: [W + 'Dumbbell-bench-press-1.png', W + 'Dumbbell-bench-press-2.png']
  },
  {
    id: 'incline-db-press', name: 'Incline Dumbbell Press', muscle: 'Chest', sets: 3, reps: 10, rest: 90,
    equipment: 'Dumbbells, Incline Bench',
    description: 'Dumbbell press on an incline for upper chest emphasis with the added freedom of dumbbell movement.',
    equipmentNotes: '30–45° incline. Dumbbells allow each arm to work independently.',
    instructions: [
      'Set bench to 30–45°, hold dumbbells at chest.',
      'Press dumbbells up and slightly inward.',
      'Lower with control for a full stretch.',
      'Repeat for all reps.'
    ],
    images: [W + 'Dumbbell-incline-bench-press-1.png', W + 'Dumbbell-incline-bench-press-2.png']
  },{
  id: 'machine-chest-press',
  name: 'Machine Chest Press (Flat)',
  muscle: 'Chest',
  sets: 3,
  reps: 12,
  rest: 75,
  equipment: 'Chest Press Machine (plate-loaded or selectorized)',
  description: 'A machine-based horizontal pressing movement that targets the pectoralis major (sternal head), anterior deltoids, and triceps. The fixed path reduces stabilization demand, allowing for focused chest stimulation.',
  equipmentNotes: 'Adjust the seat so the handles are at mid-chest level when you grip them. Keep your shoulder blades retracted and pressed against the back pad for stability.',
  instructions: [
    'Sit on the machine, back flat against the pad, feet planted firmly.',
    'Grip the handles at chest height with a neutral or slightly pronated grip.',
    'Brace your core and press the handles forward until your arms are nearly extended (but not locked).',
    'Squeeze your chest at the end range, then slowly return the handles to the starting position, feeling a stretch in your chest.'
  ],
  images: ['https://i.pinimg.com/originals/97/1f/4b/971f4bf279819907660d44bd4bab8ac0.gif','https://i.pinimg.com/originals/97/1f/4b/971f4bf279819907660d44bd4bab8ac0.gif']
},
{
  id: 'incline-machine-chest-press',
  name: 'Machine Chest Press (Incline)',
  muscle: 'Chest',
  sets: 3,
  reps: 12,
  rest: 75,
  equipment: 'Incline Chest Press Machine',
  description: 'A machine press performed on a 30–45° incline, shifting emphasis onto the clavicular head of the pectoralis major (upper chest). The machine provides stability and consistent tension throughout the movement.',
  equipmentNotes: 'Set the bench to a 30–45° incline. Adjust the seat height so the handles align with your upper chest. Keep your shoulders down and back.',
  instructions: [
    'Sit on the incline machine, back flat against the inclined pad.',
    'Grip the handles at upper-chest height.',
    'Press the handles forward and slightly upward, following the machine’s fixed arc.',
    'Squeeze your upper chest at the top, then control the weight back to the start, feeling a stretch across your collarbone area.'
  ],
  images: ['https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Chest-Press-Machine.gif', 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Chest-Press-Machine.gif']
},

  // ─── BACK (extra) ────────────────────────────────────────────────────────
  {
    id: 'db-pullover', name: 'Dumbbell Pullover', muscle: 'Back', sets: 3, reps: 12, rest: 60,
    equipment: 'Dumbbell, Flat Bench',
    description: 'A unique exercise that trains the lats, serratus, and chest through a long overhead arc.',
    equipmentNotes: 'Lie perpendicular to the bench. Keep slight bend in elbows. Lower dumbbell behind head for max lat stretch.',
    instructions: [
      'Lie perpendicular on bench, shoulders on bench.',
      'Hold one dumbbell overhead with both hands.',
      'Lower dumbbell behind head in an arc.',
      'Pull back over chest by engaging lats.'
    ],
    images: [W + 'Dumbbell-bent-arm-pullover-1.png', W + 'Dumbbell-bent-arm-pullover-2.png']
  },
  {
    id: 'chest-supported-row', name: 'Tbar Row', muscle: 'Back', sets: 3, reps: 10, rest: 75,
    equipment: 'T-Bar Row Machine',
    description: 'A chest-supported row that removes lower back strain, allowing pure focus on the mid and upper back.',
    equipmentNotes: 'Chest stays on pad throughout. Retract shoulder blades at the top for maximum mid-back activation.',
    instructions: [
      'Set pad height, lie chest against it.',
      'Grip handles, let arms hang fully.',
      'Row handles to lower chest.',
      'Squeeze shoulder blades hard at top.',
      'Lower under control.'
    ],
    images: [W + 'Cable-seated-rows-1.png', W + 'Cable-seated-rows-2.png']
  },
  {
    id: 'shrugs', name: 'Barbell Shrug', muscle: 'Back', sets: 4, reps: 12, rest: 60,
    equipment: 'Barbell or Dumbbells',
    description: 'A trap isolation exercise. Directly targets the upper trapezius for thickness and neck-to-shoulder mass.',
    equipmentNotes: 'Do not roll shoulders — straight up and down. Straps help maintain grip for heavy sets.',
    instructions: [
      'Hold barbell in front of thighs.',
      'Shrug shoulders straight up toward ears.',
      'Hold at top for 1 second.',
      'Lower under control.'
    ],
    images: [W + 'Barbell-shrugs-1.png', W + 'Barbell-shrugs-2.png']
  },

  // ─── SHOULDERS (extra) ───────────────────────────────────────────────────
  {
    id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', sets: 4, reps: 10, rest: 75,
    equipment: 'Dumbbells, Bench with Back Support',
    description: 'A seated dumbbell overhead press that builds all three deltoid heads and allows independent arm movement.',
    equipmentNotes: 'Seated version reduces core demand. Start with dumbbells at ear height, elbows at 90°.',
    instructions: [
      'Sit on bench, dumbbells at ear height.',
      'Press both dumbbells up to full extension.',
      'Lower back to ear height under control.',
      'Keep core braced throughout.'
    ],
    images: ['https://pelank.com/wp-content/uploads/2025/12/Dumbbell-Shoulder-Press.gif',  'https://pelank.com/wp-content/uploads/2025/12/Dumbbell-Shoulder-Press.gif']
  },
  {
    id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscle: 'Shoulders', sets: 3, reps: 15, rest: 45,
    equipment: 'Cable Machine, Single Handle',
    description: 'A cable variation of the lateral raise that maintains constant tension on the lateral delt throughout the range of motion.',
    equipmentNotes: 'Cable set to low position on opposite side. Lean slightly away from machine for better alignment.',
    instructions: [
      'Set pulley to low. Stand side-on to machine.',
      'Grab handle with far hand.',
      'Raise arm out to shoulder height.',
      'Lower slowly under tension.'
    ],
    images: [W + 'Bent-over-cable-lateral-raises-1.png', W + 'Bent-over-cable-lateral-raises-2.png']
  },
  {
    id: 'machine-shoulder-press', name: 'Machine Shoulder Press', muscle: 'Shoulders', sets: 4, reps: 10, rest: 75,
    equipment: 'Shoulder Press Machine',
    description: 'A machine-based overhead press for the deltoids. Ideal for beginners and as a finisher after barbell work.',
    equipmentNotes: 'Adjust seat so handles are at shoulder height.',
    instructions: [
      'Adjust seat height, grip handles at shoulders.',
      'Press handles overhead to full extension.',
      'Lower under control.',
      'Repeat for all reps.'
    ],
    images: [ 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lever-Shoulder-Press.gif', 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lever-Shoulder-Press.gif']
  },

  // ─── LEGS (extra) ────────────────────────────────────────────────────────
  {
    id: 'hip-thrust', name: 'Hip Thrust', muscle: 'Legs', sets: 4, reps: 10, rest: 90,
    equipment: 'Barbell, Bench',
    description: 'The most effective glute isolation exercise. Trains the gluteus maximus through a powerful hip extension against heavy load.',
    equipmentNotes: 'Back on bench just below shoulder blades. Barbell on hip crease — use a pad for comfort.',
    instructions: [
      'Sit against bench, barbell across hip crease.',
      'Plant feet flat, drive hips up.',
      'Squeeze glutes hard at the top.',
      'Lower hips toward floor, repeat.'
    ],
    images: [ 'https://newlife.com.cy/wp-content/uploads/2019/11/10601301-Barbell-Hip-Thrust_Hips_360.gif', 'https://newlife.com.cy/wp-content/uploads/2019/11/10601301-Barbell-Hip-Thrust_Hips_360.gif']
  },
  {
    id: 'goblet-squat', name: 'Goblet Squat', muscle: 'Legs', sets: 3, reps: 12, rest: 60,
    equipment: 'Dumbbell or Kettlebell',
    description: 'A front-loaded squat variation that promotes an upright torso and deep squat depth.',
    equipmentNotes: 'Hold weight at chest height. Drive knees out.',
    instructions: [
      'Hold dumbbell vertically at chest.',
      'Feet shoulder-width, toes slightly out.',
      'Squat deep, keeping chest tall.',
      'Drive through heels to stand up.'
    ],
    images: [ 'https://www.burnthefatinnercircle.com/members/images/1060.jpg?cb=20260514114606',  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRi68UnIaC9ff-yCiS1Fgm1_PGOQXucQNl9N5x8EdSnjg&s']
  },
  {
    id: 'seated-calf-raise', name: 'Seated Calf Raise', muscle: 'Legs', sets: 4, reps: 15, rest: 45,
    equipment: 'Seated Calf Raise Machine or Dumbbell on Knee',
    description: 'Specifically targets the soleus (deep calf muscle) which is best activated with a bent knee.',
    equipmentNotes: 'Full range of motion with a pause at the bottom.',
    instructions: [
      'Sit on machine, pad resting on lower thighs.',
      'Heels on platform, lower for full stretch.',
      'Rise up on toes as high as possible.',
      'Hold at top, lower slowly.'
    ],
    images: ['https://i.pinimg.com/originals/fd/19/2b/fd192bb6ef1ff52e0babb696c59500f1.gif', 'https://i.pinimg.com/originals/fd/19/2b/fd192bb6ef1ff52e0babb696c59500f1.gif']
  },

  // ─── ARMS (extra) ────────────────────────────────────────────────────────
  {
    id: 'cable-curl', name: 'Bicep Cable Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 60,
    equipment: 'Cable Machine, Straight Bar or Rope',
    description: 'A cable curl that maintains constant tension on the biceps throughout the range of motion.',
    equipmentNotes: 'Low pulley. Keep elbows pinned. Full extension at the bottom.',
    instructions: [
      'Attach bar to low pulley. Stand facing machine.',
      'Grip bar underhand, elbows at sides.',
      'Curl bar to chin height.',
      'Lower to full arm extension.'
    ],
    images: ['https://i.pinimg.com/originals/c1/9f/f7/c19ff7072b485096b19a2a4e17704593.gif', 'https://i.pinimg.com/originals/c1/9f/f7/c19ff7072b485096b19a2a4e17704593.gif']
  },
  {
    id: 'reverse-curl', name: 'Reverse Barbell Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 45,
    equipment: 'Barbell or EZ-Bar',
    description: 'An overhand curl that targets the brachioradialis and brachialis for complete arm development.',
    equipmentNotes: 'Overhand grip. Start light.',
    instructions: [
      'Hold barbell with overhand grip, shoulder-width.',
      'Curl bar up keeping elbows pinned.',
      'Lower under full control to start.'
    ],
    images: ['https://fitliferegime.com/wp-content/uploads/2022/06/Barbell-Reverse-Curl.gif', 'https://fitliferegime.com/wp-content/uploads/2022/06/Barbell-Reverse-Curl.gif']
  },
  {
    id: 'rope-overhead-ext', name: 'Cable Overhead Ext.', muscle: 'Arms', sets: 3, reps: 12, rest: 60,
    equipment: 'Cable Machine, Rope Attachment',
    description: 'A cable overhead tricep extension targeting the long head of the tricep through a full stretched range.',
    equipmentNotes: 'Turn away from machine, rope at head height. Keep elbows close. Full extension in front.',
    instructions: [
      'Attach rope to high pulley. Face away.',
      'Hold rope behind head, elbows bent.',
      'Extend arms forward overhead.',
      'Return slowly for full stretch.'
    ],
    images: ['https://gymvisual.com/img/p/1/8/5/9/6/18596.gif', 'https://gymvisual.com/img/p/1/8/5/9/6/18596.gif']
  },
  {
    id: 'kickbacks', name: 'Cable Kickback', muscle: 'Arms', sets: 3, reps: 15, rest: 45,
    equipment: 'Cable Machine or Dumbbell',
    description: 'A tricep isolation exercise targeting the lateral head.',
    equipmentNotes: 'Hinge forward, upper arm parallel to floor. Only the forearm moves. Squeeze hard at extension.',
    instructions: [
      'Hinge forward ~45°, upper arm at your side.',
      'Hold dumbbell or cable handle.',
      'Extend arm backward until fully straight.',
      'Squeeze tricep, return under control.'
    ],
    images: ['https://newlife.com.cy/wp-content/uploads/2019/11/08601301-Cable-kickback_Upper-arms_360.gif', 'https://newlife.com.cy/wp-content/uploads/2019/11/08601301-Cable-kickback_Upper-arms_360.gif']
  },
  {
    id: 'spider-curl', name: 'Spider Curl', muscle: 'Arms', sets: 3, reps: 12, rest: 60,
    equipment: 'Dumbbells or Barbell, Incline Bench',
    description: 'A preacher curl variation done lying face-down on an incline bench. Eliminates all momentum for pure bicep isolation.',
    equipmentNotes: 'Lie prone on an incline bench (~45°). Arms hang straight down. Curl up and squeeze hard.',
    instructions: [
      'Lie face-down on an incline bench.',
      'Let arms hang straight toward floor.',
      'Curl dumbbells up squeezing biceps hard.',
      'Lower all the way down. Full extension matters.'
    ],
    images: ['https://gymvisual.com/img/p/7/2/8/8/7288.gif', 'https://gymvisual.com/img/p/7/2/8/8/7288.gif']
  },

  // ─── CORE (extra) ────────────────────────────────────────────────────────
  {
    id: 'woodchopper', name: 'Cable Woodchopper', muscle: 'Core', sets: 3, reps: 15, rest: 45,
    equipment: 'Cable Machine, Single Handle',
    description: 'A rotational core exercise using a cable that trains the obliques through a diagonal chopping pattern.',
    equipmentNotes: 'Set pulley high for top-to-bottom chop. Low for bottom-to-top. Pivot on the back foot.',
    instructions: [
      'Set pulley high, stand side-on to machine.',
      'Grip handle with both hands.',
      'Rotate and pull diagonally across body downward.',
      'Pivot feet, return under control.'
    ],
    images: [ 'https://gymvisual.com/img/p/3/4/1/5/6/34156.gif', 'https://gymvisual.com/img/p/3/4/1/5/6/34156.gif']
  },
  {
    id: 'bird-dog', name: 'Bird Dog', muscle: 'Core', sets: 3, reps: 12, rest: 30,
    equipment: 'None (bodyweight)',
    description: 'A stability and anti-rotation core exercise that trains the erectors and glutes while building lumbar stability.',
    equipmentNotes: 'Move slowly and with control. Keep hips level.',
    instructions: [
      'Start on all fours, hands under shoulders.',
      'Extend opposite arm and leg simultaneously.',
      'Hold 2 seconds at full extension.',
      'Return and repeat with the other side.'
    ],
    images: ['https://menspower.nl/wp-content/uploads/2018/03/bird-dog.gif',  'https://menspower.nl/wp-content/uploads/2018/03/bird-dog.gif']
  },

  // ─── CARDIO ──────────────────────────────────────────────────────────────
  { id: 'burpees', name: 'Burpees', muscle: 'Cardio', sets: 4, reps: 1, rest: 60, isCardio: true, unit: 'min',
    equipment: 'None',
    description: 'A full-body explosive conditioning exercise that combines a squat, plank, push-up, and jump. One of the highest calorie burners.',
    instructions: ['Stand, drop hands to floor.', 'Jump feet back to plank.', 'Do a push-up.', 'Jump feet to hands, then jump up explosively.'],
    images: [W + 'Exercise_Press_Up.png', W + 'Squats-1.png']
  },
  { id: 'battle-ropes', name: 'Battle Ropes', muscle: 'Cardio', sets: 5, reps: 1, rest: 45, isCardio: true, unit: 'min',
    equipment: 'Battle Ropes',
    description: 'A high-intensity conditioning tool that trains the shoulders, arms, and core while spiking heart rate rapidly.',
    instructions: ['Hold one rope in each hand.', 'Create alternating or simultaneous waves.', 'Keep core braced throughout.', 'Maintain intensity for the set duration.']
  },
  { id: 'treadmill', name: 'Treadmill Run', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Treadmill',
    description: 'Steady-state or interval cardio on the treadmill. Builds aerobic base, burns calories, and improves cardiovascular health.',
    instructions: ['Set speed and incline.', 'Start with a 5 min warm-up walk.', 'Run at target pace.', 'Cool down for 5 min at end.']
  },
  { id: 'cycling', name: 'Cycling', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Stationary Bike',
    description: 'Low-impact cardiovascular exercise. Excellent for aerobic conditioning without the joint stress of running.',
    instructions: ['Adjust seat height so knee has slight bend at bottom.', 'Start at moderate resistance.', 'Pedal at steady cadence.']
  },
  { id: 'jump-rope', name: 'Jump Rope', muscle: 'Cardio', sets: 5, reps: 1, rest: 60, isCardio: true, unit: 'min',
    equipment: 'Jump Rope',
    description: 'An underrated high-intensity conditioning tool. Improves coordination, footwork, and cardiovascular fitness rapidly.',
    instructions: ['Hold handles lightly at hip height.', 'Jump on balls of feet.', 'Keep jumps small — just enough to clear the rope.', 'Breathe rhythmically.']
  },
  { id: 'rowing-machine', name: 'Rowing Machine', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Rowing Ergometer',
    description: 'A full-body low-impact cardio exercise that trains the legs, back, and arms simultaneously.',
    instructions: ['Legs drive first, then lean back, then arms pull.', 'Return in reverse: arms, lean forward, legs.', 'Aim for smooth rhythm not speed.']
  },
  { id: 'hiit', name: 'HIIT', muscle: 'Cardio', sets: 8, reps: 1, rest: 40, isCardio: true, unit: 'min',
    equipment: 'None or Treadmill/Bike',
    description: 'High-Intensity Interval Training alternates max-effort bursts with short rest. Burns more calories in less time than steady cardio.',
    instructions: ['Warm up 5 mins.', 'Sprint or max effort for 20–30 sec.', 'Rest for 40 sec.', 'Repeat for 8 rounds.', 'Cool down 5 mins.']
  },
  { id: 'stair-climber', name: 'Stair Climber', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Stair Climber Machine',
    description: 'A low-impact cardio machine that mimics stair climbing. Great for glutes and quads with high calorie burn.',
    instructions: ['Set speed, stand tall on the machine.', 'Step at a controlled pace.', 'Avoid leaning heavily on the rails.']
  },
  { id: 'elliptical', name: 'Elliptical', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Elliptical Machine',
    description: 'A zero-impact cardio machine that mimics a running stride without joint stress.',
    instructions: ['Set resistance and incline.', 'Push and pull handles for upper body involvement.', 'Maintain upright posture.']
  },
  { id: 'swimming', name: 'Swimming', muscle: 'Cardio', sets: 1, reps: 1, rest: 0, isCardio: true, unit: 'min',
    equipment: 'Pool',
    description: 'Full-body low-impact cardio. Trains all major muscle groups while being completely joint-friendly.',
    instructions: ['Warm up with easy laps.', 'Swim at a steady pace.', 'Focus on breathing rhythm.', 'Mix strokes for balanced development.']
  },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio'];

const MUSCLE_COLORS = {
  'Chest':     '#00e5a0',
  'Back':      '#00b4d8',
  'Shoulders': '#7c6fff',
  'Legs':      '#ff6b9d',
  'Arms':      '#ffb830',
  'Core':      '#ff7f50',
  'Cardio':    '#ff4757',
  'Full Body': '#00e5a0',
};

const MUSCLE_EMOJIS = {
  'Chest':     (sz = 28) => JBIcons.muscleIcon('Chest',     sz),
  'Back':      (sz = 28) => JBIcons.muscleIcon('Back',      sz),
  'Shoulders': (sz = 28) => JBIcons.muscleIcon('Shoulders', sz),
  'Legs':      (sz = 28) => JBIcons.muscleIcon('Legs',      sz),
  'Arms':      (sz = 28) => JBIcons.muscleIcon('Arms',      sz),
  'Core':      (sz = 28) => JBIcons.muscleIcon('Core',      sz),
  'Cardio':    (sz = 28) => JBIcons.muscleIcon('Cardio',    sz),
  'Full Body': (sz = 28) => JBIcons.muscleIcon('Full Body', sz),
};

const CARDIO_EMOJIS = {
  'Treadmill': '🏃', 'Cycling': '🚴', 'Jump Rope': '🪢',
  'Rowing': '🚣', 'HIIT': '⚡', 'Swimming': '🏊',
  'Walking': '🚶', 'Elliptical': '🔄', 'Stair Climber': '🏔️', 'Other': '💪'
};
