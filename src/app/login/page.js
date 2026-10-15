"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Login failed. Please check your credentials."
        );
      }

      if (data.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/register");
      }
    } catch (err) {
      setError(
        err.message || "An unexpected error occurred during login."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#faf6ee" }}>
      {/* Left panel */}
      <div
        className="hidden md:flex flex-col w-[42%] p-12 relative overflow-hidden"
        style={{ background: "#0a2112" }}
      >
        

        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(64, 161, 57, 0.95) 0%, rgba(248, 255, 40, 0.84) 100%)",
          }}
        />

        <div className="relative z-10">
          <div className="w-20 h-20 relative bg-transparent rounded-full p-1">
            <Image
              src="/assets/brand/inter-iiit-logo.png"
              alt="Logo"
              fill
              className="object-contain p-1"
            />
          </div>
        </div>

        <div style={{ flexGrow: 3 }} />

        <div className="relative z-10">
          <div
            className="text-xs font-black tracking-[0.2em] uppercase mb-3"
            style={{ color: "#0a2112" }}
          >
            9th Edition
          </div>

          <h2
            className="font-bold text-3xl leading-tight mb-4"
            style={{ color: "#ffffff" }}
          >
            All India
            <br />
            Inter-IIIT
            <br />
            Sports Meet
            <br />
            2026
          </h2>

          <div
            className="w-10 h-0.5 rounded-full mb-6"
            style={{ background: "#c9972f" }}
          />

          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(10,33,18,0.76)" }}
          >
            19–23 December 2026
            <br />
            IIITDM Kancheepuram, India
          </p>
        </div>

        <div style={{ flexGrow: 5 }} />

        <div
          className="relative z-10 text-xs"
          style={{ color: "rgba(10,33,18,0.6)" }}
        >
          © 2026 All India Inter-IIIT Sports Meet
        </div>

        <div style={{ flexGrow: 2 }} />
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm relative">

          <div className="flex md:hidden absolute -top-24 left-0 w-20 h-20">
            <Image
              src="/assets/brand/inter-iiit-logo.png"
              alt="Logo"
              fill
              className="object-contain"
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(9%) sepia(20%) saturate(1050%) hue-rotate(90deg) brightness(90%) contrast(95%)",
              }}
            />
          </div>

          {/* Main content */}
          <div className="mb-8 mt-4">
            <h1
              className="font-black text-2xl"
              style={{ color: "#0a2112" }}
            >
              Sign In
            </h1>

            <p className="text-sm mt-1.5 " style={{ color: "#777" }}>
              Access the IIIT Registration Portal.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-black uppercase tracking-wider mb-1.5"
                style={{ color: "#444" }}
              >
                IIIT code or admin email
              </label>

              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 rounded-xl text-sm outline-none transition-all"
                placeholder="e.g. iiitdm-kancheepuram or admin@example.org"
                style={{
                  border: "1.5px solid rgba(27,94,32,0.2)",
                  background: "#fff",
                  color: "#0a2112",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#1b5e20";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor =
                    "rgba(27,94,32,0.2)";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-black uppercase tracking-wider mb-1.5"
                style={{ color: "#444" }}
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-5 pr-11 py-3 rounded-xl text-sm outline-none transition-all"
                  placeholder="Enter password"
                  style={{
                    border: "1.5px solid rgba(27,94,32,0.2)",
                    background: "#fff",
                    color: "#0a2112",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1b5e20";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      "rgba(27,94,32,0.2)";
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 mr-1 focus:outline-none"
                  style={{ color: "#1b5e20" }}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3.5 rounded-xl font-black text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              style={{
                background: "#f5c518",
                color: "#0a2112",
              }}
            >
              {loading ? "Signing In..." : "Sign In →"}
            </button>
          </form>

          <div
            className="mt-7 text-center text-sm"
            style={{ color: "#888" }}
          >
            <Link
              href="/"
              className="font-bold transition-colors"
              style={{ color: "#1b5e20" }}
            >
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
