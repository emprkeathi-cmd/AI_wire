
export const sendMessageToN8N = async (webhookUrl: string, payload: any, type: string, metadata: any = {}) => {
  try {
    const isMedia = type === 'audio' || type === 'file' || (metadata.files && metadata.files.length > 0);
    
    let body: any;
    let headers: Record<string, string> = {};

    if (isMedia) {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('timestamp', new Date().toISOString());
      formData.append('metadata', JSON.stringify(metadata));

      if (type === 'audio' && payload instanceof Blob) {
        formData.append('file', payload, 'voice-message.webm');
        formData.append('payload', 'Voice Message');
      } else if (type === 'file' && metadata.files?.[0]?.blob) {
        formData.append('file', metadata.files[0].blob, metadata.files[0].name || 'file');
        formData.append('payload', payload || metadata.files[0].name);
      } else {
        formData.append('payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
      
      body = formData;
      // Fetch will automatically set the correct Content-Type with boundary for FormData
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        payload,
        type,
        metadata,
        timestamp: new Date().toISOString(),
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`n8n Error: ${response.statusText}`);
    }

    const data = await response.text();
    return data;
  } catch (error) {
    console.error('Failed to send message to n8n:', error);
    throw error;
  }
};
