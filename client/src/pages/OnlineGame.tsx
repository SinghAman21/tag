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
  const [hudTimeLeft, setHudTimeLeft] = useState(roundLength);

  const clientRef = useRef<Colyseus.Client | null>(null);
  const roomRef = useRef<Colyseus.Room | null>(null);
  const gameFrameRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastInputRef = useRef<string>("");
  const lastInputSentAtRef = useRef(0);
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
          const gameStarted = !!state.gameStarted;
          setServerHostId(state.hostId ?? "");
          setStatus(gameStarted ? "playing" : "lobby");

          // During gameplay the canvas reads Colyseus' patched room.state directly.
          // Updating React player state for every patch causes avoidable rerenders/stutter.
          if (!gameStarted) {
            const p: PlayerState[] = [];
            if (state.players) {
              state.players.forEach((value: any, key: string) => {
                p.push({ ...lobbyPlayerToState({ ...value, id: value.id || key }), isIt: false });
              });
            }
            setPlayers(p);
          }
        };

        room.onStateChange(syncState);
        room.onMessage("hostUpdate", (data: any) => {
          if (data.hostId) setServerHostId(data.hostId);
        });

        room.onMessage("lobbyState", (data: any) => {
          setPlayers((data.players ?? []).map((player: any) => ({ ...lobbyPlayerToState(player), isIt: false })));
          setServerHostId(data.hostId ?? "");
          if (data.roomCode) setActualRoomId(String(data.roomCode).toUpperCase().replace(/[^A-Z0-9]/g, ""));
        });
        room.onMessage("gameFrame", (frame: any) => {
          gameFrameRef.current = frame;
          if (frame.hostId) setServerHostId(frame.hostId);
          if (frame.roomCode) setActualRoomId(String(frame.roomCode).toUpperCase().replace(/[^A-Z0-9]/g, ""));
        });
        room.send("requestLobbyState");

        room.onMessage("gameStarted", () => {
          setRoundResult(null);
          setHudTimeLeft(roundLength);
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
      const input = {
        up: !!k["w"] || !!k["ArrowUp"] || !!k["8"],
        down: !!k["s"] || !!k["ArrowDown"] || !!k["5"],
        left: !!k["a"] || !!k["ArrowLeft"] || !!k["4"],
        right: !!k["d"] || !!k["ArrowRight"] || !!k["6"],
      };
      const serialized = `${input.up ? 1 : 0}${input.down ? 1 : 0}${input.left ? 1 : 0}${input.right ? 1 : 0}`;
      const now = performance.now();
      if (serialized !== lastInputRef.current || now - lastInputSentAtRef.current > 250) {
        room.send("input", input);
        lastInputRef.current = serialized;
        lastInputSentAtRef.current = now;
      }
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
      const nextHudTime = Math.max(0, Math.ceil(state.roundTimeRemaining ?? 0));
      setHudTimeLeft(current => current === nextHudTime ? current : nextHudTime);

      const renderState = {
        players: state.players,
        spawns: state.spawns,
        stickyPatches: state.stickyPatches,
        decoys: state.decoys,
        hostId: state.hostId,
        gameStarted: state.gameStarted,
        roundTimeRemaining: state.roundTimeRemaining,
        roundLength: state.roundLength,
        mapName: state.mapName,
        roundLengthNum: state.roundLengthNum,
        powerUpsEnabled: state.powerUpsEnabled,
        events: eventsRef.current,
      };

      const playerList = extractPlayers(state.players);
      const myIndex = playerList.findIndex(p => p.id === room.sessionId || p.name === myName);

      // Unified responsive renderer
      renderGame(ctx, renderState, canvas.width, canvas.height, map);
      renderHUD(ctx, renderState, canvas.width, myIndex >= 0 ? myIndex : 0);

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
    const roundPlayers = roundResult.scores ?? [];

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

          {/* Round Players */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.75rem",
            }}>
              {roundPlayers.map((p: any) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.85rem",
                    background: "var(--bg-card-inner)",
                    border: `3px solid ${p.color ?? "#FFFFFF"}`,
                    borderRadius: "14px",
                    boxShadow: "0 4px 0 #0D0B1C",
                  }}
                >
                  <div style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: p.color ?? "#FFFFFF",
                    border: "3px solid #FFFFFF",
                    boxShadow: "0 3px 0 rgba(0, 0, 0, 0.35)",
                  }} />
                  <div style={{
                    fontWeight: 900,
                    fontSize: "1rem",
                    color: "#FFFFFF",
                    textAlign: "center",
                  }}>
                    {p.name}
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
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0C0A1A" }}>
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
        <div style={{
          position: "fixed",
          top: "0.75rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          minWidth: "110px",
          padding: "0.25rem 0.85rem",
          background: hudTimeLeft <= 10 ? "var(--arcade-red)" : "#1E1B4B",
          border: `3px solid ${hudTimeLeft <= 10 ? "var(--arcade-yellow)" : "#383464"}`,
          borderRadius: "10px",
          boxShadow: "0 4px 0 #0D0B1C",
          color: "var(--arcade-yellow)",
          fontFamily: "'Outfit', monospace",
          fontSize: "1.35rem",
          fontWeight: 900,
          textAlign: "center",
          pointerEvents: "none",
        }}>
          {Math.floor(hudTimeLeft / 60)}:{String(hudTimeLeft % 60).padStart(2, "0")}
        </div>
      </div>
    );
  }

  return null;
}
