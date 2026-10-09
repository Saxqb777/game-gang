import './landing.css';

/** The bare domain: send the TV to /tv and phones to /pad. */
export default function Landing() {
  return (
    <main className="landing screen-centre">
      <div>
        <h1 className="wordmark landing-title">
          Gamer <span>Gang</span>
        </h1>
        <p className="landing-tagline">Your TV is the console. Your phones are the controllers.</p>
        <div className="landing-choices">
          <a className="landing-choice" href="/tv">
            <strong>This is the TV</strong>
            <small>Open on the laptop plugged into the TV</small>
          </a>
          <a className="landing-choice" href="/pad">
            <strong>This is a controller</strong>
            <small>Open on your phone, then enter the room code</small>
          </a>
        </div>
      </div>
    </main>
  );
}
