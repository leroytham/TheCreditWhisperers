import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SignupCard from "./SignupCard";
import LoginCard from "./LoginPage";
import FinancialDashboard from "./pages/FinancialDashboard";

function App() {
  return (
    <Router>
      {/* <nav>
        <Link to="/signup">Signup</Link> | <Link to="/login">Login</Link>
      </nav> */}
      <Routes>
        {/* <Route path="/signup" element={<SignupCard />} /> */}
        <Route path="/login" element={<LoginCard />} />
        <Route path="/financial_dashboard" element={<FinancialDashboard />} />

        <Route path="/" element={<LoginCard />} /> 
      </Routes>
    </Router>
  );
}

export default App;