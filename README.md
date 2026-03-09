# Neon Pinball Framework

A browser-based pinball game framework with:

- Multiple table layouts that can be switched at runtime.
- Custom-rendered, colorful playfield graphics generated with canvas.
- Physics-style ball motion with gravity, restitution, friction, and collision responses.
- Player controls:
  - **Left Shift** for the left flipper.
  - **Right Shift** for the right flipper.
  - **Control** to fire the plunger and launch the ball.
- Procedural bounce and rolling sound effects generated in real-time using the Web Audio API.
- Three-ball game loop with game over screen.

## Run locally

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000
