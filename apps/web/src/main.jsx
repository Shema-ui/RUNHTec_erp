import React from 'react';
import ReactDOM from 'react-dom/client';
import pb from '@/lib/pocketbaseClient';
import App from '@/App';
import '@/index.css';

// Start waking the server straight away (the free plan sleeps when unused).
pb.wakeServer();

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);
