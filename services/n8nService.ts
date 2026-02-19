export const sendMessageToN8N = async (
  webhookUrl: string, 
  content: string | Blob, 
  type: 'text' | 'audio' | 'reaction' | 'file' | 'event' | 'task' | 'blueprint' = 'text',
  metadata?: any
): Promise<string> => {
  if (!webhookUrl) {
    throw new Error("No webhook URL configured. Please enter a URL in Node Topology.");
  }

  // 1. Mixed Content Safety Check
  const isHttpsApp = window.location.protocol === 'https:';
  const isHttpWebhook = webhookUrl.toLowerCase().startsWith('http:');
  
  if (isHttpsApp && isHttpWebhook) {
    return "🛑 SECURITY BLOCK: App is HTTPS but Webhook is HTTP. Browser blocked the request. Use an SSL tunnel (Cloudflare/Ngrok) for your n8n instance.";
  }

  try {
    const isFilePayload = type === 'audio' || type === 'file';
    let response: Response;

    if (isFilePayload) {
      // Multipart/FormData for binary files
      const formData = new FormData();
      formData.append('type', type);
      formData.append('timestamp', new Date().toISOString());

      if (type === 'audio' && content instanceof Blob) {
        const audioFile = new File([content], 'voice_message.mp3', { type: 'audio/mpeg' });
        formData.append('file', audioFile);
        formData.append('message', 'Voice message transmission');
      } else if (type === 'file' && metadata?.files) {
        metadata.files.forEach((file: any, index: number) => {
          formData.append(`file_${index}`, file.blob, file.name);
          if (index === 0) formData.append('file', file.blob, file.name);
        });
        formData.append('message', content as string || 'File upload');
      }

      response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });
    } else {
      // JSON for text/reactions (Highest compatibility)
      const jsonBody = {
        type,
        timestamp: new Date().toISOString(),
        message: typeof content === 'string' ? content : 'Signal update',
        ...metadata
      };

      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonBody),
        mode: 'cors',
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return `❌ n8n Error (${response.status}): ${errorText.substring(0, 50)}`;
    }

    const data = await response.text();
    try {
      let jsonData = JSON.parse(data);
      if (Array.isArray(jsonData)) jsonData = jsonData[0];
      
      // Return raw string if it's a control signal (audio/call)
      if (jsonData.audio || jsonData.call !== undefined) return data;

      return jsonData.output || jsonData.message || jsonData.text || jsonData.response || 
             (typeof jsonData === 'string' ? jsonData : "Signal Acknowledged");
    } catch {
      return data || "Signal Acknowledged";
    }

  } catch (error: any) {
    console.error("Transmission Error:", error);
    
    // Handle the specific "Failed to fetch" browser error
    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
      return "⚠️ CONNECTION BLOCKED: Browser 'Failed to fetch'. \n\n1. In n8n, go to Webhook Node -> Settings -> 'CORS Allowed Origins' and set it to '*'. \n2. Ensure your n8n URL is reachable from this device.";
    }
    
    return `Transmission Failure: ${error.message}`;
  }
};