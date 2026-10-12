
$file = "d:\Programming Projects\web projects\gym\workouts-data.js"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$oldBlock = "{`n  id: 'bench-press',`n  name: 'Bench Press',`n  muscle: 'Chest',`n  sets: 4,`n  reps: 8,`n  rest: 90,`n  equipment: 'Barbell, Bench',`n  description: 'The bench press is a compound exercise that primarily works the chest, shoulders, and triceps. It" + [char]0x2019 + "s a core strength movement.',`n  instructions: [`n    'Lie on a flat bench with your feet firmly planted on the floor.',`n    'Grip the barbell slightly wider than shoulder" + [char]0x2011 + "width apart.',`n    'Lower the bar to your chest, keeping your elbows at about a 45" + [char]0xB0 + " angle.',`n    'Press the bar back up explosively until your arms are straight.',`n    'Repeat for the desired number of reps.'`n  ],`n  video_url: 'https://www.youtube.com/embed/4Y2ZdHCOXok' // optional " + [char]0x2013 + " placeholder for now`n}"

$newBlock = "{`n  id: 'bench-press',`n  name: 'Bench Press',`n  muscle: 'Chest',`n  sets: 4,`n  reps: 8,`n  rest: 90,`n  equipment: 'Barbell, Bench',`n  description: 'The barbell bench press is a foundational compound lift that targets the pectoralis major, anterior deltoids, and triceps brachii. It is one of the most effective upper-body strength builders and a staple of chest-focused training programmes.',`n  equipmentNotes: 'Use a flat bench for standard bench press. Grip width can vary " + [char]0x2014 + " closer grip shifts emphasis to triceps, wider grip emphasises chest. A power rack or spotter is recommended for heavy sets.',`n  instructions: [`n    'Lie flat on the bench with your eyes directly under the bar. Plant feet firmly on the floor.',`n    'Grip the barbell just outside shoulder-width. Retract your shoulder blades and create a slight natural arch in your lower back.',`n    'Unrack the bar and hold it directly over your chest with arms fully extended.',`n    'Inhale and lower the bar in a controlled arc to your mid-chest, elbows at roughly 45" + [char]0x2013 + "75" + [char]0xB0 + " from your torso.',`n    'Press the bar back up explosively in the same arc until your arms are fully extended.',`n    'Complete all reps, then re-rack the bar. Exhale at the top of each rep.'`n  ],`n  images: [`n    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Bench_press_2.jpg/320px-Bench_press_2.jpg',`n    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Bench_press.jpg/320px-Bench_press.jpg'`n  ],`n  video_url: 'https://www.youtube.com/embed/4Y2ZdHCOXok' // optional " + [char]0x2013 + " placeholder for now`n}"

if ($content.Contains($oldBlock)) {
    $newContent = $content.Replace($oldBlock, $newBlock)
    [System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "SUCCESS: bench press block updated"
} else {
    Write-Host "ERROR: old block not found"
}
