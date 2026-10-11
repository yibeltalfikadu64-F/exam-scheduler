import AppRoutes from './routes/AppRoutes';
import './App.css';

/**
 * Root component. Providers (Redux, Theme, Auth, Router) are mounted in
 * main.jsx; App only owns routing.
 */
export default function App() {
  return <AppRoutes />;
}
