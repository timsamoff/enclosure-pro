export const useBlobURL = () => {
  const createBlobURL = (blob: Blob) => URL.createObjectURL(blob);
  
  const revokeBlobURL = (url: string) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.debug('Failed to revoke URL:', error);
    }
  };
  
  const setupWindowCleanup = (window: Window | null, url: string) => {
    if (!window) return;
    
    const cleanup = () => revokeBlobURL(url);
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    window.addEventListener('error', cleanup);
    
    return cleanup;
  };
  
  return { createBlobURL, revokeBlobURL, setupWindowCleanup };
};