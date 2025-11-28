import React from 'react';
import '../../index.css';

export default function LoginCard() {
  return (
    <div className="login-page">
      <header className="header">
      </header>

      <main className="login-container">
        <section className="card">
          <h1 className="card-title">
            Welcome to <span className="ubs-red">News Screener</span>
            <br />
            <span className="muted">please sign in.</span>
          </h1>

          <div className="row center" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn microsoft-btn"
              onClick={() => {
                window.location.href = "/api/login";
              }}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                alt="Microsoft"
                className="ms-logo"
              />
              <span>Sign in with Microsoft</span>
            </button>
          </div>
        </section>
      </main>

      <div className="watermark"></div>
    </div>
  );
}
