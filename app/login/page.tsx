'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // If already authenticated, redirect to main application
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const token = localStorage.getItem('fromex_token');
        if (token) {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            router.replace('/');
            return;
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkExistingAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedUser = usernameOrEmail.trim();
    if (!trimmedUser) {
      setErrorMessage('Please enter your email or username.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: trimmedUser,
          password
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Invalid credentials. Please verify and try again.');
        setIsLoading(false);
        return;
      }

      // Store JWT token securely
      if (data.token) {
        localStorage.setItem('fromex_token', data.token);
        // Also set client cookie for SSR compatibility
        document.cookie = `fromex_token=${encodeURIComponent(data.token)}; path=/; max-age=604800; SameSite=Lax`;
      }

      // Smooth redirect to dashboard
      router.replace('/');
    } catch (err: any) {
      setErrorMessage('Network connection error. Please verify your server connection and try again.');
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (u: string, p: string) => {
    setUsernameOrEmail(u);
    setPassword(p);
    setErrorMessage('');
  };

  if (isCheckingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app, #f8fafc)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--text-muted, #64748b)',
          fontSize: '14px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-color, #cbd5e1)',
            borderTopColor: 'var(--primary, #1e3a8a)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span>Verifying security session...</span>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
        padding: '24px 16px',
        fontFamily: "var(--font-main, 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif)",
        color: 'var(--text-main, #0f172a)'
      }}
    >
      {/* Decorative Corporate Background Elements */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg, 10px)',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden'
        }}
      >
        {/* Card Header / Corporate Branding */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
            padding: '32px 28px 24px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: '#ffffff',
              marginBottom: '14px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            FX
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              margin: '0 0 4px 0',
              letterSpacing: '0.5px'
            }}
          >
            FROMEX
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#93c5fd',
              margin: 0,
              fontWeight: 500,
              letterSpacing: '0.2px'
            }}
          >
            Corporate Attendance & Accounting Management
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '16px',
              padding: '4px 12px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#e0e7ff',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                background: '#34d399',
                borderRadius: '50%',
                display: 'inline-block',
                boxShadow: '0 0 6px #34d399'
              }}
            />
            MongoDB Atlas Connected &bull; Admin Portal
          </div>
        </div>

        {/* Card Body / Form */}
        <div style={{ padding: '32px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--secondary, #0f172a)',
                margin: '0 0 4px 0'
              }}
            >
              Sign In to Your Account
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted, #64748b)',
                margin: 0
              }}
            >
              Enter your authorized admin or corporate credentials
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              id="login-error-alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md, 6px)',
                color: '#991b1b',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: '1.4'
              }}
            >
              <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
              <div style={{ flex: 1 }}>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email / Username Input */}
            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="login-username"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-muted, #64748b)',
                  marginBottom: '6px'
                }}
              >
                Email or Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="e.g. fromex or admin@fromex.com"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    fontSize: '14px',
                    color: 'var(--text-main, #0f172a)',
                    background: '#ffffff',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: 'var(--radius-md, 6px)',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent, #2563eb)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color, #cbd5e1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}
              >
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-muted, #64748b)'
                  }}
                >
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 40px 0 14px',
                    fontSize: '14px',
                    color: 'var(--text-main, #0f172a)',
                    background: '#ffffff',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: 'var(--radius-md, 6px)',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent, #2563eb)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color, #cbd5e1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Login Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '44px',
                background: isLoading
                  ? 'var(--text-muted, #94a3b8)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md, 6px)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.3px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)',
                transition: 'background 0.2s, transform 0.1s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.opacity = '0.95';
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.opacity = '1';
              }}
            >
              {isLoading ? (
                <>
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.4)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }}
                  />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Log In to Corporate Portal</span>
              )}
            </button>
          </form>

          {/* Quick-Fill Helper for Authorized Admin Roles */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              fontSize: '12px',
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--secondary, #0f172a)' }}>
              Quick Login Helper (Company Profiles):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                id="btn-quick-admin"
                onClick={() => fillQuickCredentials('fromex', 'fromex123')}
                style={{
                  background: 'var(--primary-light, #eff6ff)',
                  color: 'var(--primary, #1e3a8a)',
                  border: '1px solid var(--primary-border, #bfdbfe)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Root Admin: @fromex
              </button>
              <button
                type="button"
                id="btn-quick-admin2"
                onClick={() => fillQuickCredentials('admin', 'fromex123')}
                style={{
                  background: '#f5f3ff',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Admin: Vikram (@admin)
              </button>
              <button
                type="button"
                id="btn-quick-manager"
                onClick={() => fillQuickCredentials('manager', 'fromex123')}
                style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Manager: Pooja (@manager)
              </button>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '12px 28px',
            textAlign: 'center',
            fontSize: '11.5px',
            color: 'var(--text-muted, #64748b)'
          }}
        >
          <span>FROMEX Corporate Systems &bull; Enterprise Secure Access</span>
        </div>
      </div>
    </div>
  );
}
