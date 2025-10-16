import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import SignupCard from "./components/auth/SignupCard";
import LoginCard from "./components/auth/LoginPage";
import EntityPage from "./pages/EntityPage";
import SectorPage from "./pages/SectorPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginCard />} />
        <Route path="/entity" element={<EntityPage />} />
        <Route path="/sector_page" element={<SectorPage />} />
        <Route path="/" element={<LoginCard />} />
      </Routes>
    </Router>
  );
}

export default App;