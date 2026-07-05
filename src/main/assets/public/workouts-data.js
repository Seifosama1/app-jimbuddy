// Jim Buddy — Exercise Library
const EXERCISE_LIBRARY = [
  // CHEST
  { id: 'bench-press',       name: 'Bench Press',         muscle: 'Chest',     sets: 4, reps: 8,  rest: 90  },
  { id: 'incline-bench',     name: 'Incline Bench Press', muscle: 'Chest',     sets: 3, reps: 10, rest: 90  },
  { id: 'decline-bench',     name: 'Decline Bench Press', muscle: 'Chest',     sets: 3, reps: 10, rest: 75  },
  { id: 'db-fly',            name: 'Dumbbell Fly',        muscle: 'Chest',     sets: 3, reps: 12, rest: 60  },
  { id: 'push-up',           name: 'Push-Up',             muscle: 'Chest',     sets: 4, reps: 20, rest: 60  },
  { id: 'cable-crossover',   name: 'Cable Crossover',     muscle: 'Chest',     sets: 3, reps: 12, rest: 60  },
  { id: 'chest-dip',         name: 'Dip (Chest)',         muscle: 'Chest',     sets: 3, reps: 12, rest: 75  },
  { id: 'pec-deck',          name: 'Pec Deck',            muscle: 'Chest',     sets: 3, reps: 15, rest: 60  },

  // BACK
  { id: 'deadlift',          name: 'Deadlift',            muscle: 'Back',      sets: 4, reps: 5,  rest: 120 },
  { id: 'pull-up',           name: 'Pull-Up',             muscle: 'Back',      sets: 4, reps: 8,  rest: 90  },
  { id: 'lat-pulldown',      name: 'Lat Pulldown',        muscle: 'Back',      sets: 3, reps: 10, rest: 75  },
  { id: 'cable-row',         name: 'Seated Cable Row',    muscle: 'Back',      sets: 3, reps: 10, rest: 75  },
  { id: 'tbar-row',          name: 'T-Bar Row',           muscle: 'Back',      sets: 3, reps: 10, rest: 90  },
  { id: 'barbell-row',       name: 'Barbell Row',         muscle: 'Back',      sets: 4, reps: 8,  rest: 90  },
  { id: 'db-row',            name: 'Dumbbell Row',        muscle: 'Back',      sets: 3, reps: 12, rest: 60  },
  { id: 'chin-up',           name: 'Chin-Up',             muscle: 'Back',      sets: 3, reps: 8,  rest: 90  },
  { id: 'hyperext',          name: 'Hyperextension',      muscle: 'Back',      sets: 3, reps: 15, rest: 60  },

  // SHOULDERS
  { id: 'ohp',               name: 'Overhead Press',      muscle: 'Shoulders', sets: 4, reps: 8,  rest: 90  },
  { id: 'lateral-raise',     name: 'Lateral Raise',       muscle: 'Shoulders', sets: 4, reps: 15, rest: 45  },
  { id: 'front-raise',       name: 'Front Raise',         muscle: 'Shoulders', sets: 3, reps: 12, rest: 45  },
  { id: 'arnold-press',      name: 'Arnold Press',        muscle: 'Shoulders', sets: 3, reps: 10, rest: 75  },
  { id: 'face-pull',         name: 'Face Pull',           muscle: 'Shoulders', sets: 3, reps: 15, rest: 45  },
  { id: 'upright-row',       name: 'Upright Row',         muscle: 'Shoulders', sets: 3, reps: 12, rest: 60  },
  { id: 'rear-delt-fly',     name: 'Rear Delt Fly',       muscle: 'Shoulders', sets: 3, reps: 15, rest: 45  },

  // LEGS
  { id: 'squat',             name: 'Squat',               muscle: 'Legs',      sets: 4, reps: 8,  rest: 120 },
  { id: 'leg-press',         name: 'Leg Press',           muscle: 'Legs',      sets: 3, reps: 12, rest: 90  },
  { id: 'rdl',               name: 'Romanian Deadlift',   muscle: 'Legs',      sets: 3, reps: 10, rest: 90  },
  { id: 'leg-curl',          name: 'Leg Curl',            muscle: 'Legs',      sets: 3, reps: 12, rest: 60  },
  { id: 'leg-ext',           name: 'Leg Extension',       muscle: 'Legs',      sets: 3, reps: 15, rest: 60  },
  { id: 'calf-raise',        name: 'Calf Raise',          muscle: 'Legs',      sets: 4, reps: 20, rest: 45  },
  { id: 'hack-squat',        name: 'Hack Squat',          muscle: 'Legs',      sets: 3, reps: 10, rest: 90  },
  { id: 'lunges',            name: 'Lunges',              muscle: 'Legs',      sets: 3, reps: 12, rest: 60  },
  { id: 'bulgarian-squat',   name: 'Bulgarian Split Squat',muscle:'Legs',      sets: 3, reps: 10, rest: 75  },
  { id: 'sumo-deadlift',     name: 'Sumo Deadlift',       muscle: 'Legs',      sets: 4, reps: 6,  rest: 120 },

  // ARMS
  { id: 'barbell-curl',      name: 'Barbell Curl',        muscle: 'Arms',      sets: 3, reps: 10, rest: 60  },
  { id: 'hammer-curl',       name: 'Hammer Curl',         muscle: 'Arms',      sets: 3, reps: 12, rest: 45  },
  { id: 'tricep-pushdown',   name: 'Tricep Pushdown',     muscle: 'Arms',      sets: 3, reps: 12, rest: 60  },
  { id: 'skull-crusher',     name: 'Skull Crusher',       muscle: 'Arms',      sets: 3, reps: 10, rest: 60  },
  { id: 'preacher-curl',     name: 'Preacher Curl',       muscle: 'Arms',      sets: 3, reps: 10, rest: 60  },
  { id: 'tricep-dip',        name: 'Tricep Dip',          muscle: 'Arms',      sets: 3, reps: 15, rest: 60  },
  { id: 'incline-curl',      name: 'Incline Dumbbell Curl',muscle: 'Arms',     sets: 3, reps: 12, rest: 45  },
  { id: 'overhead-tri-ext',  name: 'Overhead Tricep Ext.',muscle: 'Arms',      sets: 3, reps: 12, rest: 45  },
  { id: 'concentration-curl',name: 'Concentration Curl',  muscle: 'Arms',      sets: 3, reps: 12, rest: 45  },

  // CORE
  { id: 'plank',             name: 'Plank',               muscle: 'Core',      sets: 3, reps: 60, rest: 60  },
  { id: 'crunches',          name: 'Crunches',            muscle: 'Core',      sets: 4, reps: 20, rest: 45  },
  { id: 'russian-twist',     name: 'Russian Twist',       muscle: 'Core',      sets: 3, reps: 20, rest: 45  },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise',   muscle: 'Core',      sets: 3, reps: 12, rest: 60  },
  { id: 'ab-rollout',        name: 'Ab Rollout',          muscle: 'Core',      sets: 3, reps: 10, rest: 60  },
  { id: 'bicycle-crunch',    name: 'Bicycle Crunch',      muscle: 'Core',      sets: 3, reps: 20, rest: 45  },
  { id: 'leg-raise',         name: 'Lying Leg Raise',     muscle: 'Core',      sets: 3, reps: 15, rest: 45  },
  { id: 'cable-crunch',      name: 'Cable Crunch',        muscle: 'Core',      sets: 3, reps: 15, rest: 45  },// CHEST
  { id: 'db-press',          name: 'Dumbbell Bench Press',muscle: 'Chest',     sets: 4, reps: 8,  rest: 90  },
  { id: 'incline-db-press',  name: 'Incline Dumbbell Press',muscle:'Chest',     sets: 3, reps: 10, rest: 90  },

  // BACK
  { id: 'db-pullover',       name: 'Dumbbell Pullover',   muscle: 'Back',      sets: 3, reps: 12, rest: 60  },
  { id: 'chest-supported-row',name:'Tbar Row', muscle: 'Back',      sets: 3, reps: 10, rest: 75  },
  { id: 'shrugs',            name: 'Barbell Shrug',       muscle: 'Back',      sets: 4, reps: 12, rest: 60  },

  // SHOULDERS
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press',muscle:'Shoulders',sets: 4, reps: 10, rest: 75  },
  { id: 'cable-lateral-raise',name:'Cable Lateral Raise', muscle: 'Shoulders', sets: 3, reps: 15, rest: 45  },
  { id: 'machine-shoulder-press', name: 'machine Shoulder Press',muscle:'Shoulders',sets: 4, reps: 10, rest: 75  },

  // LEGS
  { id: 'hip-thrust',        name: 'Hip Thrust',          muscle: 'Legs',      sets: 4, reps: 10, rest: 90  },
  { id: 'goblet-squat',      name: 'Goblet Squat',        muscle: 'Legs',      sets: 3, reps: 12, rest: 60  },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise',   muscle: 'Legs',      sets: 4, reps: 15, rest: 45  },

  // ARMS
  { id: 'cable-curl',        name: 'Bicep Cable Curl',    muscle: 'Arms',      sets: 3, reps: 12, rest: 60  },
  { id: 'reverse-curl',      name: 'Reverse Barbell Curl',muscle: 'Arms',      sets: 3, reps: 12, rest: 45  },
  { id: 'rope-overhead-ext', name: 'Cable Overhead Ext.', muscle: 'Arms',      sets: 3, reps: 12, rest: 60  },
  { id: 'kickbacks',         name: 'cable Kickback',   muscle: 'Arms',      sets: 3, reps: 15, rest: 45  },
  { id: 'spider-curl',        name: 'spider Curl',    muscle: 'Arms',      sets: 3, reps: 12, rest: 60  },

  // CORE
  { id: 'woodchopper',       name: 'Cable Woodchopper',   muscle: 'Core',      sets: 3, reps: 15, rest: 45  },
  { id: 'bird-dog',          name: 'Bird Dog',            muscle: 'Core',      sets: 3, reps: 12, rest: 30  },

  // CARDIO
  { id: 'burpees',           name: 'Burpees',             muscle: 'Cardio',    sets: 4, reps: 1,  rest: 60, isCardio: true, unit: 'min' },
  { id: 'battle-ropes',      name: 'Battle Ropes',        muscle: 'Cardio',    sets: 5, reps: 1,  rest: 45, isCardio: true, unit: 'min' },

  // CARDIO
  { id: 'treadmill',         name: 'Treadmill Run',       muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
  { id: 'cycling',           name: 'Cycling',             muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
  { id: 'jump-rope',         name: 'Jump Rope',           muscle: 'Cardio',    sets: 5, reps: 1,  rest: 60, isCardio: true, unit: 'min' },
  { id: 'rowing-machine',    name: 'Rowing Machine',      muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
  { id: 'hiit',              name: 'HIIT',                muscle: 'Cardio',    sets: 8, reps: 1,  rest: 40, isCardio: true, unit: 'min' },
  { id: 'stair-climber',     name: 'Stair Climber',       muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
  { id: 'elliptical',        name: 'Elliptical',          muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
  { id: 'swimming',          name: 'Swimming',            muscle: 'Cardio',    sets: 1, reps: 1,  rest: 0, isCardio: true, unit: 'min' },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio'];

// Muscle group stickman icons — teal-highlighted stickman SVGs
// Each value is a function(size) that returns an inline SVG string.
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