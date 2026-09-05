import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as Colyseus from "colyseus.js";
import {
  type PlayerState,
  MAPS,
  POWER_UP_INDEX_TO_TYPE,
} from "chase-tag-shared";
import { renderGame, renderHUD, extractPlayers } from "../game/renderer.js";
import ArcadeButton from "../components/ArcadeButton.js";

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || "ws://localhost:2567";
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generatePublicRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function lobbyPlayerToState(player: any): PlayerState {
  return {
    id: player.id,
    name: player.name,
    x: player.x ?? 0,
    y: player.y ?? 0,
    vx: player.vx ?? 0,
    vy: player.vy ?? 0,
    isIt: !!player.isIt,
    alive: player.alive ?? true,
    facing: { x: player.facingX ?? 1, y: player.facingY ?? 0 },
    color: player.color,
    score: player.score ?? 0,
    ready: !!player.ready,
    activePowerUp: player.activePowerUpType >= 0 ? {
      type: POWER_UP_INDEX_TO_TYPE[player.activePowerUpType] ?? "speed_surge",
      remainingMs: player.activePowerUpRemaining ?? 0,
      durationMs: player.activePowerUpDuration ?? 1,
    } : null,
    powerUpCooldown: player.powerUpCooldown ?? 0,
    heldPowerUp: player.heldPowerUp >= 0 ? POWER_UP_INDEX_TO_TYPE[player.heldPowerUp] : null,
  };
}

export default function OnlineGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const normalizedRoomCode = (roomId ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const navigate = useNavigate();
  const roomOptions = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`tag-room-options:${normalizedRoomCode}`) ?? "{}");
    } catch {
      return {};
    }
  }, [normalizedRoomCode]);
  const myName = roomOptions.name ?? "Player";
  const isHost = roomOptions.host === true;
  const hostKey = roomOptions.hostKey;
  const roundLength = Number(roomOptions.roundLength ?? 120);
  const mapName = roomOptions.mapName ?? "arena";
  const powerUpsEnabled = roomOptions.powerUpsEnabled !== false;

  const [status, setStatus] = useState<"connecting" | "lobby" | "playing" | "ended">("connecting");
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [actualRoomId, setActualRoomId] = useState(normalizedRoomCode);
  const [serverHostId, setServerHostId] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [copied, setCopied] = useState(false);

  const clientRef = useRef<Colyseus.Client | null>(null);
  const roomRef = useRef<Colyseus.Room | null>(null);
  const gameFrameRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const rafRef = useRef<number>(0);
  const connectedRef = useRef(false);
  const eventsRef = useRef<any[]>([]);

  useEffect(() => {
    const connect = async () => {
      if (connectedRef.current) return;
      connectedRef.current = true;
      try {
        const client = new Colyseus.Client(COLYSEUS_URL);
        clientRef.current = client;

        const publicRoomCode = normalizedRoomCode === "NEW" ? generatePublicRoomCode() : normalizedRoomCode;
        const joinOptions = { name: myName, hostKey, roomCode: publicRoomCode };
        let room: Colyseus.Room;
        if (isHost) {
          try {
            room = await client.join("tag_room", joinOptions);
          } catch {
            room = await client.create("tag_room", {
              ...joinOptions,
              config: {
                roundLength,
                mapName,
                powerUpsEnabled,
              },
            });
          }
        } else {
          room = await client.join("tag_room", joinOptions);
        }

        roomRef.current = room;
        setActualRoomId(publicRoomCode);
        setConnectionError("");

        if (normalizedRoomCode === "NEW") {
          sessionStorage.setItem(`tag-room-options:${publicRoomCode}`, JSON.stringify({
            host: true,
            name: myName,
            roundLength,
            mapName,
            powerUpsEnabled,
            hostKey,
          }));
          window.history.replaceState(null, "", `/online/${publicRoomCode}`);
        }

        const syncState = (state: any) => {
          const p: PlayerState[] = [];
          if (state.players) {
            state.players.forEach((value: any, key: string) => {
              p.push(lobbyPlayerToState({ ...value, id: value.id || key }));
            });
          }
          setPlayers(p);
          setServerHostId(state.hostId ?? "");
          setStatus(state.gameStarted ? "playing" : "lobby");
        };

        room.onStateChange(syncState);
        room.onMessage("hostUpdate", (data: any) => {
          if (data.hostId) setServerHostId(data.hostId);
        });

        room.onMessage("lobbyState", (data: any) => {
          setPlayers((data.players ?? []).map(lobbyPlayerToState));
          setServerHostId(data.hostId ?? "");
          if (data.roomCode) setActualRoomId(String(data.roomCode).toUpperCase().replace(/[^A-Z0-9]/g, ""));
        });
        room.onMessage("gameFrame", (frame: any) => {
          gameFrameRef.current = frame;
          setPlayers((frame.players ?? []).map(lobbyPlayerToState));
          setServerHostId(frame.hostId ?? "");
          if (frame.roomCode) setActualRoomId(String(frame.roomCode).toUpperCase().replace(/[^A-Z0-9]/g, ""));
        });
        room.send("requestLobbyState");

        room.onMessage("gameStarted", () => {
          setRoundResult(null);
          setStatus("playing");
        });

        room.onMessage("tag", (data: any) => {
          eventsRef.current.push({
            id: `ev_${Date.now()}`,
            type: "tag",
            text: "👑 TAGGED!",
            x: 800,
            y: 450,
            color: "#EF4444",
            remainingMs: 1500,
            maxMs: 1500,
          });
        });

        room.onMessage("roundEnd", (data: any) => {
          setRoundResult(data);
          setStatus("ended");
        });

      } catch (err) {
        console.error("Failed to connect:", err);
        setConnectionError(err instanceof Error ? err.message : "Unable to connect to room");
        setStatus("connecting");
      }
    };

    connect();

    return () => {
      gameFrameRef.current = null;
      roomRef.current?.leave();
      clientRef.current = null;
      roomRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [myName, isHost, hostKey, normalizedRoomCode, roundLength, mapName, powerUpsEnabled]);

  useEffect(() => {
    if (status !== "playing") return;

    const handleDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);

    const sendInput = () => {
      const room = roomRef.current;
      if (!room) return;
      const k = keysRef.current;
      room.send("input", {
        up: !!k["w"] || !!k["ArrowUp"] || !!k["8"],
        down: !!k["s"] || !!k["ArrowDown"] || !!k["5"],
        left: !!k["a"] || !!k["ArrowLeft"] || !!k["4"],
        right: !!k["d"] || !!k["ArrowRight"] || !!k["6"],
        usePowerUp: !!k["e"],
      });
      keysRef.current["e"] = false;
    };

    const inputInterval = setInterval(sendInput, 1000 / 30);

    const gameLoop = () => {
      const canvas = canvasRef.current;
      const room = roomRef.current;
      if (!canvas || !room) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const state = gameFrameRef.current ?? room.state;
      const map = MAPS[state.mapName] ?? MAPS.arena;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Decay online events
      eventsRef.current = eventsRef.current.filter(e => {
        e.remainingMs -= 16;
        return e.remainingMs > 0;
      });
      state.events = eventsRef.current;

      const playerList = extractPlayers(state.players);
      const myIndex = playerList.findIndex(p => p.id === room.sessionId || p.name === myName);

      // Unified responsive renderer
      renderGame(ctx, state, canvas.width, canvas.height, map);
      renderHUD(ctx, state, canvas.width, myIndex >= 0 ? myIndex : 0);

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      clearInterval(inputInterval);
      cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  const amHost = serverHostId ? roomRef.current?.sessionId === serverHostId : isHost;

  const handleStartGame = useCallback(() => {
    roomRef.current?.send("startGame");
  }, []);

  const handleCopyCode = () => {
    if (!actualRoomId) return;
    navigator.clipboard?.writeText(actualRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. CONNECTING VIEW
  if (status === "connecting") {
    return (
      <div className="arcade-bg">
        <div className="arcade-card" style={{ maxWidth: "460px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }} className="arcade-btn-pulse">
            📡
          </div>
          <h2 style={{
            fontFamily: "'Fredoka', sans-serif",
            fontSize: "2rem",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 0.8rem 0",
          }}>
            Connecting to Arena...
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
            {connectionError || `Contacting Colyseus server on ${COLYSEUS_URL}`}
          </p>

          {connectionError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{
                background: "rgba(255, 71, 87, 0.15)",
                border: "2px solid var(--arcade-red)",
                borderRadius: "10px",
                color: "var(--arcade-red)",
                padding: "0.75rem",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}>
                Could not reach the game server. Ensure <code>npm run dev:server</code> is running!
              </div>
              <ArcadeButton color="secondary" size="md" onClick={() => navigate("/")}>
                ← BACK TO MENU
              </ArcadeButton>
            </div>
          ) : (
            <div style={{
              display: "inline-block",
              padding: "0.6rem 1.4rem",
              background: "var(--bg-card-inner)",
              border: "2px solid var(--border-arcade)",
              borderRadius: "999px",
              color: "var(--arcade-yellow)",
              fontWeight: 800,
              fontSize: "0.9rem",
            }}>
              ESTABLISHING WEBSOCKET CONNECTION...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. ROUND END VIEW
  if (status === "ended" && roundResult) {
    const sortedScores = [...(roundResult.scores ?? [])].sort((a: any, b: any) => b.score - a.score);

    return (
      <div className="arcade-bg">
        <div className="arcade-card" style={{ maxWidth: "560px", textAlign: "center" }}>
          <div style={{
            display: "inline-block",
            background: "var(--arcade-yellow)",
            color: "#3A2800",
            padding: "0.3rem 1.2rem",
            borderRadius: "999px",
            border: "3px solid #0D0B1C",
            fontWeight: 900,
            fontSize: "0.95rem",
            letterSpacing: "0.08em",
            boxShadow: "0 4px 0 #D4A30B",
            marginBottom: "1rem",
          }}>
            MATCH COMPLETE!
          </div>

          <h1 style={{
            fontFamily: "'Fredoka', sans-serif",
            fontSize: "3rem",
            fontWeight: 900,
            color: "#FFFFFF",
            margin: "0 0 1.2rem 0",
          }}>
            ROUND OVER!
          </h1>

          {/* Loser Highlight */}
          <div style={{
            background: "rgba(255, 71, 87, 0.15)",
            border: "3px solid var(--arcade-red)",
            borderRadius: "16px",
            padding: "1rem 1.5rem",
            marginBottom: "1.8rem",
            boxShadow: "0 6px 0 rgba(196, 38, 53, 0.4)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.3rem" }}>💀</div>
            <div style={{ color: "var(--arcade-red)", fontWeight: 800, fontSize: "1.4rem" }}>
              {roundResult.loserName} WAS "IT"!
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginTop: "0.2rem" }}>
              Time ran out while they were tagged. They lose this round!
            </div>
          </div>

          {/* Scores Roster */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{
              fontSize: "0.9rem",
              fontWeight: 800,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
              textAlign: "left",
            }}>
              Final Tag Standings
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {sortedScores.map((s: any, rank: number) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1.2rem",
                    background: s.wasIt ? "rgba(255, 71, 87, 0.15)" : "var(--bg-card-inner)",
                    border: `3px solid ${s.wasIt ? "var(--arcade-red)" : "#0D0B1C"}`,
                    borderRadius: "12px",
                    boxShadow: "0 4px 0 #0D0B1C",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>
                      {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "🎖️"}
                    </span>
                    <span style={{
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: s.wasIt ? "var(--arcade-red)" : "#FFFFFF",
                    }}>
                      {s.name}
                    </span>
                    {s.wasIt && (
                      <span style={{
                        background: "var(--arcade-red)",
                        color: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 900,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "6px",
                      }}>
                        IT
                      </span>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--arcade-yellow)" }}>
                    {s.score} {s.score === 1 ? "tag" : "tags"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            {amHost && (
              <ArcadeButton color="green" size="lg" fullWidth onClick={handleStartGame} icon="🔄">
                REMATCH!
              </ArcadeButton>
            )}
            <ArcadeButton color="secondary" size="lg" onClick={() => navigate("/")} icon="🏠">
              LEAVE
            </ArcadeButton>
          </div>
        </div>
      </div>
    );
  }

  // 3. MULTIPLAYER LOBBY VIEW
  if (status === "lobby") {
    return (
      <div className="arcade-bg">
        <div className="arcade-card" style={{ maxWidth: "640px" }}>
          {/* Header & Room Code Box */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.8rem",
            borderBottom: "3px solid var(--border-arcade)",
            paddingBottom: "1.2rem",
          }}>
            <div>
              <div style={{
                display: "inline-block",
                background: "rgba(30, 144, 255, 0.2)",
                color: "#4BA7FF",
                padding: "0.2rem 0.6rem",
                borderRadius: "6px",
                border: "2px solid #1E90FF",
                fontWeight: 800,
                fontSize: "0.75rem",
                marginBottom: "0.3rem",
              }}>
                ONLINE MATCH LOBBY
              </div>
              <h1 style={{
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "1.8rem",
                fontWeight: 800,
                color: "#FFFFFF",
                margin: 0,
              }}>
                Arena: {MAPS[mapName]?.name || "Skyline Stage"}
              </h1>
            </div>

            {/* Room Code Badge with Copy */}
            <div style={{
              background: "var(--bg-card-inner)",
              border: "3px solid #0D0B1C",
              borderRadius: "14px",
              padding: "0.5rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 0 #0D0B1C",
            }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
                  ROOM CODE
                </div>
                <div style={{
                  fontFamily: "'Outfit', monospace",
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color: "var(--arcade-yellow)",
                  letterSpacing: "0.15em",
                  lineHeight: 1,
                }}>
                  {actualRoomId}
                </div>
              </div>
              <button
                onClick={handleCopyCode}
                className="arcade-chip"
                style={{ padding: "0.45rem 0.8rem", fontSize: "0.85rem" }}
              >
                {copied ? "✅ COPIED!" : "📋 COPY"}
              </button>
            </div>
          </div>

          {/* Participants Counter */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.8rem",
          }}>
            <span style={{
              fontSize: "0.9rem",
              fontWeight: 800,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              PARTICIPANTS ({players.length}/13)
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {players.length < 2 ? "Waiting for players to join..." : "Ready to launch!"}
            </span>
          </div>

          {/* Participant Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginBottom: "2rem",
            maxHeight: "360px",
            overflowY: "auto",
            paddingRight: "4px",
          }}>
            {players.map(p => {
              const isMe = p.name === myName;
              const isServerHost = p.id === serverHostId;

              return (
                <div
                  key={p.id}
                  style={{
                    background: "var(--bg-card-inner)",
                    border: `3px solid ${p.color}`,
                    borderRadius: "14px",
                    padding: "0.8rem",
                    boxShadow: `0 4px 0 ${p.color}40, 0 6px 0 #0D0B1C`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <span style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: p.color,
                    border: "2px solid #FFFFFF",
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: "1rem",
                      color: "#FFFFFF",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {p.name} {isMe && "(YOU)"}
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem" }}>
                      {isServerHost && (
                        <span style={{
                          background: "var(--arcade-yellow)",
                          color: "#3A2800",
                          fontSize: "0.65rem",
                          fontWeight: 900,
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                        }}>
                          HOST
                        </span>
                      )}
                      {p.isIt && (
                        <span style={{
                          background: "var(--arcade-red)",
                          color: "#FFFFFF",
                          fontSize: "0.65rem",
                          fontWeight: 900,
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                        }}>
                          STARTS IT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div style={{ display: "flex", gap: "1rem" }}>
            {amHost ? (
              <ArcadeButton
                color="green"
                size="lg"
                fullWidth
                onClick={handleStartGame}
                disabled={players.length < 1}
                icon="▶"
              >
                START GAME
              </ArcadeButton>
            ) : (
              <div style={{
                flex: 1,
                background: "var(--bg-card-inner)",
                border: "3px solid #0D0B1C",
                borderRadius: "16px",
                padding: "0.85rem",
                textAlign: "center",
                color: "var(--text-dim)",
                fontWeight: 700,
              }}>
                ⏳ WAITING FOR HOST TO START...
              </div>
            )}

            <ArcadeButton color="secondary" size="lg" onClick={() => navigate("/")}>
              LEAVE
            </ArcadeButton>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACTIVE PLAYING CANVAS VIEW
  if (status === "playing") {
    return (
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
          background: "#0C0A1A",
          cursor: "none",
        }}
      />
    );
  }

  return null;
}
