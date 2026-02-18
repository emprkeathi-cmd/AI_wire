
export const sendMessageToN8N = async (
  webhookUrl: string, 
  content: string | Blob, 
  type: 'text' | 'audio' | 'reaction' | 'file' | 'event' | 'task' | 'blueprint' = 'text',
  metadata?: any
): Promise<string> => {
  if (!webhookUrl) {
    throw new Error("No webhook URL configured for this agent.");
  }

  try {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('timestamp', new Date().toISOString());

    if (type === 'audio' && content instanceof Blob) {
      const audioFile = new File([content], 'voice_message.webm', { type: content.type || 'audio/webm' });
      formData.append('file', audioFile);
      formData.append('message', 'Voice message received');
    } else if (type === 'reaction') {
      formData.append('reaction', content as string);
      formData.append('original_message', metadata?.originalContent || '');
      formData.append('message', `Reaction: ${content}`);
    } else if (type === 'file' && metadata?.files) {
      metadata.files.forEach((file: any, index: number) => {
        formData.append(`file_${index}`, file.blob, file.name);
        if (index === 0) formData.append('file', file.blob, file.name);
      });
      formData.append('message', content as string || 'Files uploaded');
    } else if (type === 'event') {
      formData.append('message', content as string);
      formData.append('event_date', metadata?.date || '');
      formData.append('category_name', metadata?.categoryName || '');
    } else if (type === 'task') {
      formData.append('message', content as string);
      formData.append('todo_status', metadata?.todoStatus || '');
      formData.append('todo_reminder', String(!!metadata?.todoReminder));
      formData.append('todo_notes', metadata?.todoNotes || '');
      formData.append('category_name', metadata?.categoryName || '');
    } else if (type === 'blueprint') {
      formData.append('message', content as string);
      formData.append('title', metadata?.title || '');
      if (metadata?.assets) {
        formData.append('assets_count', metadata.assets.length.toString());
      }
    } else if (typeof content === 'string') {
      formData.append('message', content);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway Error (${response.status}): ${errorText.substring(0, 100)}`);
    }

    const data = await response.text();
    try {
      const jsonData = JSON.parse(data);
      return jsonData.output || jsonData.message || jsonData.text || jsonData.response || 
             (typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData));
    } catch {
      return data;
    }
  } catch (error) {
    console.error("Transmission Failure:", error);
    return `Transmission Error: ${error instanceof Error ? error.message : 'Unknown link failure'}`;
  }
};
