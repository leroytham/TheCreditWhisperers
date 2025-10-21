import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginCard from "./components/auth/LoginPage";
import PortfolioPage from "./pages/PortfolioPage";
import EntityPage from "./pages/EntityPage";
import SectorPage from "./pages/SectorPage";
import NotificationPage from "./pages/NotificationPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginCard />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/entity" element={<EntityPage />} />
        <Route path="/sector_page" element={<SectorPage />} />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route path="/" element={<LoginCard />} />
      </Routes>
    </Router>
  );
}

export default App;