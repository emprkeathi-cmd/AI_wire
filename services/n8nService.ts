export const sendMessageToN8N = async (
  webhookUrl: string, 
  content: string | Blob, 
  type: 'text' | 'audio' | 'reaction' | 'file' | 'event' = 'text',
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
      formData.append('file', content, 'voice_message.webm');
      formData.append('message', 'Voice message received');
    } else if (type === 'reaction') {
      formData.append('reaction', content as string);
      formData.append('original_message', metadata?.originalContent || '');
      formData.append('message', `Reaction: ${content} to message: "${metadata?.originalContent?.substring(0, 50)}..."`);
    } else if (type === 'file' && metadata?.files) {
      metadata.files.forEach((file: any, index: number) => {
        // Appending to both indexed and standard 'file' field for n8n compatibility
        formData.append(`file_${index}`, file.blob, file.name);
        if (index === 0) formData.append('file', file.blob, file.name);
      });
      formData.append('message', content as string || 'Files uploaded');
    } else if (typeof content === 'string') {
      formData.append('message', content);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    try {
      const jsonData = JSON.parse(data);
      return jsonData.output || jsonData.message || jsonData.text || (typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData));
    } catch {
      return data;
    }
  } catch (error) {
    console.error("n8n communication error:", error);
    return `Error connecting to n8n: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};
