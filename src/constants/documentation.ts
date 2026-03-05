export const getModuleDocumentation = (mode: string | undefined, categories?: any[]): string => {
  const categoryList = categories?.map(c => `"${c.name}"`).join(', ') || '...';
  
  switch (mode) {
    case 'calendar':
      return `// Available Categories: ${categoryList}
{
  "command": "create", // Options: "create", "delete"
  "category": "Meeting", // Must match one of your chat's categories
  "appointment": "Project sync",
  "date": "2026-03-05" // YYYY-MM-DD
}`;
    case 'todo':
      return `// Available Categories: ${categoryList}
{
  "command": "save", // Options: "create", "delete", "done"
  "category": "Work", // Must match one of your chat's categories
  "title": "Finish report",
  "notes": "Include the Q1 data",
  "reminder": true // Optional: true/false
}`;
    case 'blueprint':
      return `{
  "type": "blueprint",
  "title": "Data Analyst",
  "content": "You are a data analyst...",
  "assets": ["https://example.com/icon.png"]
}`;
    case 'alarm':
      return `// For Alarms
{
  "alarm_time": "08:00", // HH:MM (24h format)
  "alarm_date": "2026-03-04", // Optional: YYYY-MM-DD
  "alarm_label": "Wake up",
  "activate_alarm": true
}

// For Timers
{
  "timer_duration": "300", // Duration in seconds
  "start_timer": true
}`;
    case 'call':
      return `{
  "call": true,
  "audio": "https://url-to-speech-file.mp3",
  "signal": "end"
}`;
    case 'news':
      return `{
  "type": "post",
  "title": "NEURAL GRID OPTIMIZATION",
  "text": "The central processing nodes have been upgraded to version 4.2.",
  "questions": [ // Optional array of questions
    {
      "question": "What happened today?",
      "answers": ["Upgraded", "Downgraded", "Nothing"],
      "correct_answer": "Upgraded"
    }
  ]
}`;
    case 'social':
      return `{
  "type": "social_post",
  "title": "Instagram Draft",
  "content": "Check out our new neural interface!",
  "assets": ["https://image-url.com/photo.jpg"]
}`;
    case 'sync':
      return `{
  "type": "sync_update",
  "content": "Neural network synchronized."
}`;
    default:
      return `{
  "content": "Hello from n8n"
}`;
  }
};
