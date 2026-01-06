import { Routes, Route } from "react-router-dom";
import { NavigationProvider } from "./contexts/NavigationContext";
import { CatalogProvider } from "./contexts/CatalogContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailsPage from "./pages/ProductDetailsPage";
import "./styles/notification.css";

function App() {
  return (
    <NavigationProvider>
      <ErrorBoundary>
        <NotificationProvider>
          <CatalogProvider>
            <Routes>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/produtos/:code" element={<ProductDetailsPage />} />
            </Routes>
          </CatalogProvider>
        </NotificationProvider>
      </ErrorBoundary>
    </NavigationProvider>
  );
}

export default App;
