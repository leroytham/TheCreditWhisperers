import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SignupCard from "./components/auth/SignupCard";
import LoginCard from "./components/auth/LoginPage";
import FinancialDashboard from "./pages/FinancialDashboard";
import PortfolioPage from "./pages/PortfolioPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginCard />} />
        <Route path="/financial_dashboard" element={<FinancialDashboard />} />
        <Route path="/portfolio_page" element={<PortfolioPage />} />
        <Route path="/" element={<LoginCard />} /> 
      </Routes>
    </Router>
  );
}

export default App;