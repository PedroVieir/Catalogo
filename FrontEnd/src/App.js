import { Routes, Route } from "react-router-dom";
import { NotificationProvider } from "./contexts/NotificationContext";
import { CatalogProvider } from "./contexts/CatalogContext";
import ErrorBoundary from "./components/ErrorBoundary";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailsPage from "./pages/ProductDetailsPage";
import "./styles/notification.css";

function App() {
  return (
    <NotificationProvider>
      <ErrorBoundary>
        <CatalogProvider>
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/produtos/:code" element={<ProductDetailsPage />} />
          </Routes>
        </CatalogProvider>
      </ErrorBoundary>
    </NotificationProvider>
  );
}

export default App;
