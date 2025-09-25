import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SignupCard from "./SignupCard";
import LoginCard from "./LoginPage";
import Dashboard from "./new_dashboard";
import Dashboardnew from "./Dashboard";

function App() {
  return (
    <Router>
      <nav>
        <Link to="/signup">Signup</Link> | <Link to="/login">Login</Link>
      </nav>
      <Routes>
        <Route path="/signup" element={<SignupCard />} />
        <Route path="/login" element={<LoginCard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard_new" element={<Dashboardnew />} />

        <Route path="/" element={<SignupCard />} /> 
      </Routes>
    </Router>
  );
}

export default App;
