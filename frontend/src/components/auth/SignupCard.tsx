import React, { useState } from "react";
import "../../index.css"; // make sure you style here
import apiService from '../../services/api';

export default function SignupCard() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage(" Passwords do not match");
      return;
    }

    try {
      const res = await apiService.signup(username, password);
      const data = res.data;

      if (data.success) {
        setMessage("Signup successful! You can now log in.");
        setUsername("");
        setPassword("");
        setConfirmPassword("");
      } else {
        setMessage("" + (data.message || "Signup failed"));
      }
    } catch (err) {
      console.error(err);
      setMessage(" Server error, please try again");
    }
  };

  const canSubmit =
    username.trim() && password.trim() && confirmPassword.trim();

  return (
    <div className="signup-page">
      <section className="card">
        <h1 className="card-title">
          Create your <span className="ubs-red">UBS News Screener</span> account
          <br />
          <span className="muted">sign up below.</span>
        </h1>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="label">Username</span>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="label">Confirm Password</span>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <div className="row end">
            <button type="submit" className="btn" disabled={!canSubmit}>
              Sign Up
            </button>
          </div>
        </form>

        {message && <p style={{ marginTop: "1rem" }}>{message}</p>}
      </section>
    </div>
  );
}
