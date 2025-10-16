import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SignupCard from "./components/auth/SignupCard";
import LoginCard from "./components/auth/LoginPage";
import FinancialDashboard from "./pages/FinancialDashboard";
import SectorPage from "./pages/SectorPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginCard />} />
        <Route path="/financial_dashboard" element={<FinancialDashboard />} />
        <Route path="/sector_page" element={<SectorPage />} />
        <Route path="/" element={<LoginCard />} /> 
      </Routes>
    </Router>
  );
}

export default App;