# AI Wire // n8n Integration Protocol

This document defines the data structures for communication between the **AI Wire PWA** and your **n8n instance**.

---

## 1. Transmission Flow

### Outbound: App → n8n (Webhooks)
The app sends POST requests to your configured n8n Webhook URL. 
- **Text/Signals:** Sent as `application/json`.
- **Media (Audio/Files):** Sent as `multipart/form-data`.

### Inbound: n8n → App (The Door Uplink)
The app listens to a `ntfy.sh` topic (Receiver ID). To send data back, your n8n workflow should use an **HTTP Request Node** to POST a JSON string or raw text to `https://ntfy.sh/{receiverId}`.

---

## 2. Outbound Formats (Sending to n8n)

When the PWA sends a message, n8n receives a JSON body with this structure:

### Standard Chat / Task / Event
```json
{
  "type": "text", // or "task", "event", "blueprint"
  "timestamp": "2023-10-27T10:00:00.000Z",
  "message": "The user's text input",
  "date": "YYYY-MM-DD", // included for calendar/todo
  "categoryId": "123",
  "categoryName": "Work"
}
```

### Reaction (Social/News/Chat)
```json
{
  "type": "reaction",
  "message": "✅ Post Action",
  "reaction": "✅",
  "comment": "Feedback text",
  "originalContent": "The content being reacted to"
}
```

---

## 3. Inbound Formats (n8n Controlling the PWA)

To trigger specific UI behaviors, n8n must push these JSON structures to the **ntfy.sh** uplink.

### A. Temporal Node (Calendar)
You can send raw text like `2023-12-25 | Work | Finish Report` or structured JSON:
```json
{
  "date": "2023-12-25",
  "category": "Work",
  "content": "Finish the annual report"
}
```

### B. Task Grid (Todo)
Use the `command` key to manage the list:
```json
{
  "command": "save", // "save", "delete", "done"
  "category": "Personal",
  "title": "Buy Groceries",
  "notes": "Milk and Eggs",
  "reminder": true
}
```

### C. News Feed (Article Loop)
Trigger a high-tech news card with an optional validation quiz:
```json
{
  "type": "post",
  "title": "Global News Update",
  "content": "Detailed article body text...",
  "quiz": [
    {
      "question": "What is the primary topic?",
      "options": ["Tech", "Finance", "AI"],
      "correct_answer": "AI"
    }
  ]
}
```

### D. Social Management Hub
Queue a post for approval/rejection:
```json
{
  "type": "social_post",
  "title": "Instagram Draft",
  "content": "Check out our new neural interface!",
  "assets": ["https://image-url.com/photo.jpg"]
}
```

### E. Blueprint Engine (Reconstruction)
Force the app to render a specific project layout:
```json
{
  "sync_type": "full_recreation_payload",
  "title": "Project Alpha",
  "content": "+++ Header \n [[Image|0]] \n - Metadata",
  "assets": ["data:image/png;base64..."]
}
```

### F. Voice Loop (Call Control)
Manage the real-time voice session:
```json
{
  "call": true, // Opens the mic
  "audio": "https://url-to-speech-file.mp3", // Plays response
  "signal": "end" // Optional: Closes the session after playback
}
```

### G. Alarm Module (IoT)
Set remote timers or alarms:
```json
{
  "timer_duration": "300", // Seconds
  "start_timer": true,
  "alarm_time": "14:30",
  "activate_alarm": true
}
```

---

## 4. Tips for n8n Success
1. **CORS:** Set `CORS Allowed Origins` to `*` in your n8n Webhook node settings.
2. **Response Node:** The PWA expects a text response. Use a **Respond to Webhook** node in n8n returning `{{ $json.output }}` or similar.
3. **Ntfy.sh Headers:** When sending from n8n to ntfy, you can set the `Title` and `Priority` headers to trigger native mobile notifications via the ntfy app if the user has it installed.