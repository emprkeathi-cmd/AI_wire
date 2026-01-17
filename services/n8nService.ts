
import { Message } from '../types';

export const sendMessageToN8N = async (
  webhookUrl: string, 
  content: string | Blob, 
  type: 'text' | 'audio' = 'text'
): Promise<string> => {
  if (!webhookUrl) {
    throw new Error("No webhook URL configured for this agent.");
  }

  try {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('timestamp', new Date().toISOString());

    if (type === 'audio' && content instanceof Blob) {
      // Sending as a real file named 'voice_message.webm'
      formData.append('file', content, 'voice_message.webm');
      formData.append('message', 'Voice message received');
    } else if (typeof content === 'string') {
      formData.append('message', content);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      // Note: Don't set Content-Type header when using FormData; the browser does it automatically with the boundary
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    try {
      const jsonData = JSON.parse(data);
      // common n8n structures
      return jsonData.output || jsonData.message || jsonData.text || (typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData));
    } catch {
      return data;
    }
  } catch (error) {
    console.error("n8n communication error:", error);
    return `Error connecting to n8n: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};
