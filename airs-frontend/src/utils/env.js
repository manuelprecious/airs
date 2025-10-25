export const validateEnv = () => {
  const required = ['VITE_BACKEND_URL', 'VITE_LANGFLOW_URL', 'VITE_LANGFLOW_API_KEY'];
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }
  return true;
};