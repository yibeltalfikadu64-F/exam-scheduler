import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import store from './store';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

// Global design system (external CSS, imported once, in cascade order)
import './styles/variables.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/users.css';
import './styles/responsive.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          {/* Opt in to the v7 behaviours now to silence the v6 deprecation
              warnings (react-router-dom ^6.30.x supports both flags). */}
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
