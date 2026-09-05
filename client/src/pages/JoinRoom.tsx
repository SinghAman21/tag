import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { randomPlayerName } from "../playerNames.js";
import ArcadeButton from "../components/ArcadeButton.js";

export default function JoinRoom() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState(() => randomPlayerName());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!roomCode.trim() || !playerName.trim()) return;
    setJoining(true);
    setError("");

    const code = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    sessionStorage.setItem(
      `tag-room-options:${code}`,
      JSON.stringify({
        host: false,
        name: playerName.trim(),
      })
    );
    navigate(`/online/${encodeURIComponent(code)}`);
  };

  const handleRandomize = () => {
    setPlayerName(randomPlayerName());
  };

  return (
    <div className="arcade-bg">
      <div className="arcade-card" style={{ maxWidth: "480px" }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.8rem",
          borderBottom: "3px solid var(--border-arcade)",
          paddingBottom: "1.2rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "2.4rem" }}>🎟️</span>
            <div>
              <h1 style={{
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "2rem",
                fontWeight: 800,
                color: "#FFFFFF",
                margin: 0,
              }}>
                Join Match
              </h1>
              <span style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
                Enter your friend's room code
              </span>
            </div>
          </div>

          <ArcadeButton color="secondary" size="sm" onClick={() => navigate("/")}>
            ← BACK
          </ArcadeButton>
        </div>

        {/* Room Code Big Input Box */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{
            display: "block",
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}>
            🔑 6-Character Room Code
          </label>
          <input
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="e.g. X9K2LM"
            className="arcade-input"
            style={{
              textAlign: "center",
              letterSpacing: "0.25em",
              fontSize: "1.6rem",
              fontFamily: "'Outfit', monospace",
              color: "var(--arcade-yellow)",
              fontWeight: 900,
            }}
            maxLength={6}
            autoFocus
          />
        </div>

        {/* Player Name Field */}
        <div style={{ marginBottom: "1.8rem" }}>
          <label style={{
            display: "block",
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}>
            👤 Your Display Name
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="arcade-input"
              maxLength={12}
            />
            <button
              onClick={handleRandomize}
              className="arcade-chip"
              title="Generate Random Name"
              type="button"
              style={{ padding: "0 1rem", fontSize: "1.2rem" }}
            >
              🎲
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(255, 71, 87, 0.15)",
            border: "2px solid var(--arcade-red)",
            borderRadius: "10px",
            color: "var(--arcade-red)",
            fontWeight: 700,
            padding: "0.6rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Action Button */}
        <ArcadeButton
          color="red"
          size="lg"
          fullWidth
          onClick={handleJoin}
          disabled={!roomCode.trim() || !playerName.trim() || joining}
          icon="🚀"
        >
          {joining ? "JOINING MATCH..." : "JOIN ARENA"}
        </ArcadeButton>
      </div>
    </div>
  );
}
