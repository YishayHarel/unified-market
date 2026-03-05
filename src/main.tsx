import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { supabase } from '@/integrations/supabase/client'

// Expose Supabase on window for console debugging: await window.supabaseClient.auth.getSession()
;(window as unknown as { supabaseClient?: typeof supabase }).supabaseClient = supabase

console.log('🚀 main.tsx loading...');
console.log('Root element:', document.getElementById("root"));

try {
  createRoot(document.getElementById("root")!).render(<App />);
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Error rendering app:', error);
}
