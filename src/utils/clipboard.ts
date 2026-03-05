export const copyToClipboard = async (text: string) => { 
  try { 
    await navigator.clipboard.writeText(text); 
    if (navigator.vibrate) navigator.vibrate(50); 
  } catch (err) {} 
};
