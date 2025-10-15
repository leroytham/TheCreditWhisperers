import React, { useState } from 'react';
import '../../index.css';
import { Link } from 'react-router-dom';
import { useNavigate } from "react-router-dom";



export default function LoginCard() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); 


  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:8000/LoginAdmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Login successful!");
        sessionStorage.setItem("user", JSON.stringify(data.user));
        navigate("/financial_dashboard");

        if (remember) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      } else {
        setMessage(" " + (data.message || "Login failed"));
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error, please try again");
    }
  };

  const canSubmit = username.trim() && password.trim();

  return (
    <div className="login-page">
      <header className="header">
        {/* REMOVED: UBS Logo */}
        <span className="notif">Notification</span>
      </header>

      <main className="login-container">
        <section className="card">
          <h1 className="card-title">
            Welcome to <span className="ubs-red">News Screener</span>
            <br />
            <span className="muted">please sign in.</span>
          </h1>

          {/* <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <input
                type="text"
                inputMode="text"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>

            <label className="field">
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div className="row between">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            </div>

            <div className="row end">
              <button type="submit" className="btn" disabled={!canSubmit}>
                Sign in
              </button>
            </div>
          </form> */}


          {/* <div className="row center" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn microsoft-btn"
              onClick={() => window.location.replace("http://localhost:8000/login")}              >
              Sign in with Microsoft
            </button>
          </div> */}

        <div className="row center" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn microsoft-btn"
            onClick={() => {
              // Temporary bypass: Set a mock user in sessionStorage
              const mockUser = { username: "dev_user", email: "dev@example.com" };
              sessionStorage.setItem("user", JSON.stringify(mockUser));
              navigate("/financial_dashboard");
            }}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
              alt="Microsoft"
              className="ms-logo"
            />
            <span>Sign in with Microsoft (Dev Bypass)</span>
          </button>
        </div>



          {message && <p className="message">{message}</p>}

          {/* <div className="links">
            <a href="#">Forgot <span>username</span> or <span>password</span>?</a>
          </div> */}

          {/* <div className="register">
                    <Link to="/signup" className="register-link">
                        Register for Access <span aria-hidden="true" className="chev">›</span>
                    </Link>
                    </div> */}
        </section>
      </main>

      <div className="watermark"></div>
    </div>
  );
}